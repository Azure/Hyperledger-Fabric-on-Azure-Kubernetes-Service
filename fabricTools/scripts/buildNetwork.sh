#!/bin/bash

scriptStartTime="$(date -u +%s)"
nodeType="${HLF_NODE_TYPE}"
nodeCount="${HLF_NODE_COUNT}"
orgName="${HLF_ORG_NAME}"
nginxIP="${HLF_STATIC_IP}"
domainName="${HLF_DOMAIN_NAME}"
StateDB="${HLF_BACKEND_DB}"
SHARED_STORAGE_PATH="/fabric"
DEPLOYMENTS="/var/hyperledger/deployments"
SCRIPTS="/var/hyperledger/scripts"

. /var/hyperledger/scripts/utils.sh
. /var/hyperledger/scripts/globals.sh

function deployNginx {
  echo
  logMessage "Info" "Starting Nginx controller" $scriptStartTime 
  echo
  exportSecret fabric-tools-secrets ${toolsNamespace} ${nginxNamespace}
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/serviceAccountNginxIngress.yaml -n ${nginxNamespace}" "Nginx service account creation failed!!!" $scriptStartTime
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/serviceAccountNginxIngressBackend.yaml -n ${nginxNamespace}" "Nginx backend service account creation failed!!!" $scriptStartTime
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/clusterRoleNginxIngress.yaml -n ${nginxNamespace}" "Nginx cluster role creation failed!!!" $scriptStartTime
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/clusterRoleBindingNginxIngress.yaml
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/clusterRoleBindingNginxIngress.yaml -n ${nginxNamespace}" "Nginx cluster role binding failed!!!" $scriptStartTime
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/roleNginxIngress.yaml -n ${nginxNamespace}" "Nginx role creation failed!!!" $scriptStartTime
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/roleBindingNginxIngress.yaml
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/roleBindingNginxIngress.yaml -n ${nginxNamespace}" "Nginx role binding failed!!!" $scriptStartTime
  sed -i -e "s/{nginxipaddress}/${nginxIP}/g" $DEPLOYMENTS/nginx/serviceNginxIngressController.yaml 
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/serviceNginxIngressController.yaml -n ${nginxNamespace}" "Nginx controller service creation failed!!!" $scriptStartTime
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/serviceNginxIngressDefaultBackend.yaml -n ${nginxNamespace}" "Nginx backend service creation failed!!!" $scriptStartTime
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/deploymentNginxIngressController.yaml
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/deploymentNginxIngressController.yaml -n ${nginxNamespace}" "Nginx controller deployment failed!!!" $scriptStartTime
  executeKubectlWithRetry "kubectl apply -f $DEPLOYMENTS/nginx/deploymentNginxIngressDefaultBackend.yaml -n ${nginxNamespace}" "Nginx backend deployment failed!!!" $scriptStartTime
  echo
  logMessage "Info" "Successfully started Nginx!" $scriptStartTime 
  echo
  updateHlfStatus "Inprogress" "Successfully started Nginx." $scriptStartTime 
}

function deployFabricCA
{
  if [[ ( ! -f "$CA_ADMIN_USERNAME_FILE" ) || ( ! -f $CA_ADMIN_PASSWORD_FILE ) || ( ! -f $CA_DB_TYPE_FILE ) || ( ! -f $CA_DB_DATASOURCE_FILE ) ]]; then
      verifyResult 1 "Fabric CA secret not mounted properly!" $scriptStartTime 
  fi

  caAdminUsername=$(cat $CA_ADMIN_USERNAME_FILE)
  caAdminPassword=$(cat $CA_ADMIN_PASSWORD_FILE)
  escapedForSedCaAdminPassword=${caAdminPassword/&/\\&}
  caDbType=$(cat $CA_DB_TYPE_FILE)
  caDbDatasource=$(cat $CA_DB_DATASOURCE_FILE)

  if [ -z "$(kubectl -n ${toolsNamespace} get secret hlf-ca-idcert -o jsonpath="{.data['rca\.pem']}")" ]; then
    echo
    logMessage "Info" "Generate Root Certificate for Fabric CA" $scriptStartTime 
    echo
    yes | /var/hyperledger/scripts/generateRootCertificate.sh ${orgName} ${domainName}
    res=$?
    if [ $res -ne 0 ]; then
      logMessage "Error" "Generating Fabric CA Root certificate failed!" $scriptStartTime  
      rm -rf /tmp/rca/*
      exit 1
    fi
    updateHlfStatus "Inprogress" "Generated Root Certificate for Fabric CA." $scriptStartTime 
  else
    echo
    logMessage "Info" "Root Certificate for Fabric CA provided by user" $scriptStartTime 
    echo
    mkdir -p /tmp/fabric-ca/tls-certfile
    echo "$(kubectl -n ${toolsNamespace} get secret hlf-ca-idcert -o jsonpath="{.data['rca\.pem']}" | base64 -d)" > /tmp/fabric-ca/tls-certfile/rca.pem
    updateHlfStatus "Inprogress" "Root Certificate for Fabric CA provided by user." $scriptStartTime 
  fi

  sed -i -e "s/{username}/${caAdminUsername}/g" -e "s/{password}/${escapedForSedCaAdminPassword}/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  sed -i -e "s/{ca-server-db-type}/${caDbType}/g" -e "s/{ca-server-db-datasource}/${caDbDatasource}/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  sed -i -e "s/{orgName}/$orgName/g" -e "s/{domainName}/$domainName/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  executeKubectlWithRetry "kubectl -n ${caNamespace} create secret generic fabric-ca-server-config --from-file=fabric-ca-server-config.yaml="/var/hyperledger/deployments/fabric-ca-server-config.yaml"" "Fabric CA server config creation failed" $scriptStartTime

  openssl x509 -checkend 0 -noout -in /var/hyperledger/deployments/pgcerts/pg-ssl-rootcert.pem
  res=$?
  if [ $res -eq 0 ]
  then
    executeKubectlWithRetry "kubectl -n ${caNamespace} create secret generic pg-ssl-rootcert --from-file=pg-ssl-rootcert.pem="/var/hyperledger/deployments/pgcerts/pg-ssl-rootcert.pem"" "Creation of secret for Postgres SSL root certificate failed!" $scriptStartTime
  else	  
    verifyResult $res "Postgres SSL root certificate Expired!" $scriptStartTime   
  fi	  

  exportSecret fabric-tools-secrets ${toolsNamespace} ${caNamespace}
  exportSecret hlf-ca-idcert ${toolsNamespace} ${caNamespace}
  exportSecret hlf-ca-idkey ${toolsNamespace} ${caNamespace}
  
  echo
  logMessage "Info" "Starting Fabric CA" $scriptStartTime 
  echo
  executeKubectlWithRetry "kubectl -n ${caNamespace} apply -f $DEPLOYMENTS/fabric-ca.yaml" "Starting Fabric CA failed!" $scriptStartTime
  echo
  logMessage "Info" "Successfully started Fabric CA!" $scriptStartTime 
  echo
}

function createManagedDisk {
  echo
  logMessage "Info" "Deploying Azure Managed Disks for each HLF node" $scriptStartTime 
  echo
  for ((i=1;i<=$nodeCount;i++));
  do
    sed -e "s/{nodeNum}/${i}/g" $DEPLOYMENTS/azureDisk/persistentVolumeClaim-template.yaml > $DEPLOYMENTS/presistentVolumeClaim-${nodeType}${i}.yaml
    executeKubectlWithRetry "kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/presistentVolumeClaim-${nodeType}${i}.yaml" "Deploying Managed Disk for ${nodeType}${i} failed!" $scriptStartTime
  done
  updateHlfStatus "Inprogress" "Deployed Azure Managed Disks for each HLF node." $scriptStartTime 
}

function deployNodes {
  exportSecret fabric-tools-secrets ${toolsNamespace} ${nodesNamespace}
  exportSecret hlf-ca-idcert ${caNamespace} ${nodesNamespace}
  exportSecret hlf-tlsca-idcert ${caNamespace} ${nodesNamespace}
  exportSecret hlf-admin-idcert ${adminNamespace} ${nodesNamespace}

  executeKubectlWithRetry "kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/configmap-mutual-tls.yaml" "Creating configmap for triggering mutual TLS failed!" $scriptStartTime

  if [ "$nodeType" = "orderer" ]; then
      echo
      logMessage "Info" "Generate configtx.yaml file" $scriptStartTime 
      echo
      createConfigTxYaml ${orgName} ${domainName} ${nodeCount} "crypto-config/ordererOrganizations/${orgName}"
      res=$?
      verifyResult $res "Generating configtx.yaml failed!" $scriptStartTime 
      
      echo
      logMessage "Info" "Generating Genesis block" $scriptStartTime 
      echo
      rm -rf /tmp/channel-artifacts
      mkdir /tmp/channel-artifacts
      {
      export FABRIC_CFG_PATH="/tmp"
      configtxgen -profile SampleEtcdRaftProfile -outputBlock /tmp/channel-artifacts/genesis.block
      res=$?
      verifyResult $res "Generating genesis block failed!" $scriptStartTime 
  
      # Store genesis block in secrets
      GENESIS_BLOCK=$(ls /tmp/channel-artifacts/genesis.block)
      executeKubectlWithRetry "kubectl -n ${nodesNamespace} create secret generic hlf-genesis-block --from-file=genesis.block=$GENESIS_BLOCK" "Creating secret for genesis block failed!" $scriptStartTime
      }
      updateHlfStatus "Inprogress" "Generated genesis block." $scriptStartTime 
     
      for ((i=1;i<=$nodeCount;i++));
      do
        sed -e "s/{nodeNum}/${i}/g" -e "s/{orgName}/${orgName}/g" $DEPLOYMENTS/orderer/fabric-orderer-template.yaml >  $DEPLOYMENTS/orderer/fabric-orderer${i}.yaml 
        executeKubectlWithRetry "kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/orderer/fabric-orderer${i}.yaml" "Starting orderer node ${i} failed!" $scriptStartTime
        echo 
        logMessage "Info" "Started orderer node ${i}" $scriptStartTime
        updateHlfStatus "Inprogress" "Started orderer node ${i}." $scriptStartTime  
      done
  else
      for ((i=1;i<=$nodeCount;i++));
      do
        sed -e "s/{nodeNum}/${i}/g" -e "s/{orgName}/${orgName}/g" -e "s/{domainName}/${domainName}/g" $DEPLOYMENTS/peer/fabric-peer-template-${StateDB}.yaml >  $DEPLOYMENTS/peer/fabric-peer${i}.yaml
        executeKubectlWithRetry "kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/peer/fabric-peer${i}.yaml" "Starting peer node ${i} failed!" $scriptStartTime
        echo
        logMessage "Info" "Started peer node ${i}" $scriptStartTime 
        updateHlfStatus "Inprogress" "Started peer node ${i}." $scriptStartTime 
      done
  fi
}

function deployIngressConfiguration {
  createCaIngress ${domainName}
  executeKubectlWithRetry "kubectl -n ${caNamespace} apply -f /tmp/caIngress.yaml" "Applying ca ingress configuration failed!" $scriptStartTime
  echo
  logMessage "Info" "Successfully applied ca ingress configuration!" $scriptStartTime 
  updateHlfStatus "Inprogress" "Successfully applied ca ingress configuration." $scriptStartTime 
  
  createNodeIngress ${nodeType} ${nodeCount} ${domainName}
  executeKubectlWithRetry "kubectl -n ${nodesNamespace} apply -f /tmp/nodeIngress.yaml" "Applying node ingress configuration failed!" $scriptStartTime
  echo
  logMessage "Info" "Successfully applied node ingress configuration!" $scriptStartTime 
  updateHlfStatus "Inprogress" "Successfully applied node ingress configuration." $scriptStartTime 
}

executeKubectlWithRetry "kubectl create namespace ${statusNamespace}" "${statusNamespace} creation failed!" $scriptStartTime
executeKubectlWithRetry "kubectl create namespace ${caNamespace}" "${caNamespace} creation failed!" $scriptStartTime
executeKubectlWithRetry "kubectl create namespace ${nodesNamespace}" "${nodesNamespace} creation failed!" $scriptStartTime
executeKubectlWithRetry "kubectl create namespace ${adminNamespace}" "${adminNamespace} creation failed!" $scriptStartTime
executeKubectlWithRetry "kubectl create namespace ${nginxNamespace}" "${nginxNamespace} creation failed!" $scriptStartTime

scriptCurrentTime="$(date -u +%s)"
scriptElapsedTime=$(($scriptCurrentTime - $scriptStartTime))
hlfStatus="Inprogress"
hlfDescription="Starting setup '$nodeType' HLF Org '$orgName' having '$nodeCount' nodes."
executeKubectlWithRetry "kubectl -n ${statusNamespace} create configmap hlf-status --from-literal hlfStatus="${hlfStatus}" --from-literal hlfDescription="${hlfDescription} Time elapsed: $scriptElapsedTime seconds"" "Storing Hlf status in configmap 'hlf-status' failed!" $scriptStartTime 

deployFabricCA

deployNginx

# Enable log for CA DNS query
kubectl apply -f $DEPLOYMENTS/ca-custom-coredns.yaml || true
executeKubectlWithRetry "kubectl delete pod --namespace kube-system --selector k8s-app=kube-dns" "Deletion of pod failed!" $scriptStartTime
# wait for coreDNS to come up
sleep 2m

waitCAServerUp ${scriptStartTime}

updateHlfStatus "Inprogress" "Fabric CA is UP." $scriptStartTime 

echo
logMessage "Info" "Generating artifacts using Fabric CA" $scriptStartTime 
echo
$SCRIPTS/generateCertificates.sh $orgName $nodeCount $domainName $nodeType
res=$?
verifyResult $res "Generating artifacts using Fabric CA failed!" $scriptStartTime 
updateHlfStatus "Inprogress" "Generated artifacts using Fabric CA." $scriptStartTime 

createManagedDisk

deployNodes

deployIngressConfiguration

exportSecret fabric-tools-secrets ${toolsNamespace} ${adminNamespace}
exportSecret hlf-ca-idcert ${caNamespace} ${adminNamespace}
exportSecret hlf-tlsca-idcert ${caNamespace} ${adminNamespace}

executeKubectlWithRetry "kubectl -n ${adminNamespace} create configmap org-detail --from-literal=orgName=${orgName} --from-literal=domainName=${domainName} --from-literal=nodeCount=${nodeCount}" "Storing ${orgName} organization metadata in configmap failed!" $scriptStartTime
echo
logMessage "Info" "Stored ${orgName} organization metadata in kubernetes configmap!" $scriptStartTime 

updateHlfStatus "Done" "Successfully setup HLF Organization." $scriptStartTime 

exit 0

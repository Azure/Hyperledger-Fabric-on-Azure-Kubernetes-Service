#!/bin/bash

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
. /var/hyperledger/scripts/namespaces.sh

function deployNginx {
  echo
  echo "============ Starting Nginx controller ==============="
  echo
  kubectl apply -f $DEPLOYMENTS/nginx/serviceAccountNginxIngress.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx service account creation failed!!!"
  kubectl apply -f $DEPLOYMENTS/nginx/serviceAccountNginxIngressBackend.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx backend service account creation failed!!!"
  kubectl apply -f $DEPLOYMENTS/nginx/clusterRoleNginxIngress.yaml -n ${nginxNamespace} 
  res=$?
  verifyResult $res "Nginx cluster role creation failed!!!"
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/clusterRoleBindingNginxIngress.yaml
  kubectl apply -f $DEPLOYMENTS/nginx/clusterRoleBindingNginxIngress.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx cluster role binding failed!!!"
  kubectl apply -f $DEPLOYMENTS/nginx/roleNginxIngress.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx role creation failed!!!"
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/roleBindingNginxIngress.yaml
  kubectl apply -f $DEPLOYMENTS/nginx/roleBindingNginxIngress.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx role binding failed!!!"
  sed -i -e "s/{nginxipaddress}/${nginxIP}/g" $DEPLOYMENTS/nginx/serviceNginxIngressController.yaml
  kubectl apply -f $DEPLOYMENTS/nginx/serviceNginxIngressController.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx controller service creation failed!!!"
  kubectl apply -f $DEPLOYMENTS/nginx/serviceNginxIngressDefaultBackend.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx backend service creation failed!!!"
  sed -i -e "s/{namespace}/${nginxNamespace}/g" $DEPLOYMENTS/nginx/deploymentNginxIngressController.yaml
  kubectl apply -f $DEPLOYMENTS/nginx/deploymentNginxIngressController.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx controller deployment failed!!!"
  kubectl apply -f $DEPLOYMENTS/nginx/deploymentNginxIngressDefaultBackend.yaml -n ${nginxNamespace}
  res=$?
  verifyResult $res "Nginx backend deployment failed!!!"
  echo
  echo "============ Successfully started Nginx! ==============="
  echo
  updateHlfStatus "Inprogress" "Successfully started Nginx"
}

function deployFabricCA
{
  if [ -z "$(kubectl -n ${toolsNamespace} get secret hlf-ca-idcert -o jsonpath="{.data['rca\.pem']}")" ]; then
    echo
    echo "========== Generate Root Certificate for Fabric CA ============"
    echo
    yes | /var/hyperledger/scripts/generateRootCertificate.sh ${orgName} ${domainName}
    res=$?
    if [ $res -ne 0 ]; then
      logError $res "Generating Fabric CA Root certificate failed"
      rm -rf /tmp/rca/*
      exit 1
    fi
    updateHlfStatus "Inprogress" "Generated Root Certificate for Fabric CA"
  else
    echo
    echo "========== Root Certificate for Fabric CA provided by user ============"
    echo
    mkdir -p /tmp/fabric-ca/tls-certfile
    echo "$(kubectl -n ${toolsNamespace} get secret hlf-ca-idcert -o jsonpath="{.data['rca\.pem']}" | base64 -d)" > /tmp/fabric-ca/tls-certfile/rca.pem
    updateHlfStatus "Inprogress" "Root Certificate for Fabric CA provided by user"
  fi
  sed -i -e "s/{username}/$FABRIC_CA_BOOTSTRAP_USERNAME/g" -e "s/{password}/$FABRIC_CA_BOOTSTRAP_PASSWORD/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  sed -i -e "s/{ca-server-db-type}/$FABRIC_CA_SERVER_DB_TYPE/g" -e "s/{ca-server-db-datasource}/$FABRIC_CA_SERVER_DB_DATASOURCE/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  sed -i -e "s/{orgName}/$orgName/g" -e "s/{domainName}/$domainName/g" /var/hyperledger/deployments/fabric-ca-server-config.yaml
  kubectl -n ${caNamespace} create secret generic fabric-ca-server-config --from-file=fabric-ca-server-config.yaml="/var/hyperledger/deployments/fabric-ca-server-config.yaml"
  
  exportSecret fabric-tools-secrets ${toolsNamespace} ${caNamespace}
  exportSecret hlf-ca-idcert ${toolsNamespace} ${caNamespace}
  exportSecret hlf-ca-idkey ${toolsNamespace} ${caNamespace}
  
  echo
  echo "========== Starting Fabric CA ============"
  echo
  kubectl -n ${caNamespace} apply -f $DEPLOYMENTS/fabric-ca.yaml
  res=$?
  verifyResult $res "Starting Fabric CA failed!"
  echo
  echo "========== Successfully started Fabric CA ============"
  echo
}

function createManagedDisk {
  echo
  echo "========== Deploying Azure Managed Disks for each HLF node ============"
  echo
  for ((i=1;i<=$nodeCount;i++));
  do
    sed -e "s/{nodeNum}/${i}/g" $DEPLOYMENTS/azureDisk/persistentVolumeClaim-template.yaml > $DEPLOYMENTS/presistentVolumeClaim-${nodeType}${i}.yaml
    kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/presistentVolumeClaim-${nodeType}${i}.yaml
    res=$?
    verifyResult $res "Deploying Managed Disk for ${nodeType}${i} failed!"
  done
  updateHlfStatus "Inprogress" "Deployed Azure Managed Disks for each HLF node"
}

function deployNodes {
  exportSecret fabric-tools-secrets ${toolsNamespace} ${nodesNamespace}
  exportSecret hlf-ca-idcert ${caNamespace} ${nodesNamespace}
  exportSecret hlf-tlsca-idcert ${caNamespace} ${nodesNamespace}
  exportSecret hlf-admin-idcert ${adminNamespace} ${nodesNamespace}
  
  
  if [ "$nodeType" = "orderer" ]; then
      echo
      echo "=========== Generate configtx.yaml file =========="
      echo
      createConfigTxYaml ${orgName} ${domainName} ${nodeCount} "crypto-config/ordererOrganizations/${orgName}"
      res=$?
      verifyResult $res "Generating configtx.yaml failed!"
  
      echo
      echo "============ Generating Genesis block =============="
      echo
      rm -rf /tmp/channel-artifacts
      mkdir /tmp/channel-artifacts
      {
      export FABRIC_CFG_PATH="/tmp"
      configtxgen -profile SampleEtcdRaftProfile -outputBlock /tmp/channel-artifacts/genesis.block
      res=$?
      verifyResult $res "Generating genesis block failed!"
  
      # Store genesis block in secrets
      GENESIS_BLOCK=$(ls /tmp/channel-artifacts/genesis.block)
      kubectl -n ${nodesNamespace} create secret generic hlf-genesis-block --from-file=genesis.block=$GENESIS_BLOCK
      res=$?
      verifyResult $res "Creating secret for genesis block failed!"
      }
      updateHlfStatus "Inprogress" "Generated genesis block"
     
      for ((i=1;i<=$nodeCount;i++));
      do
        sed -e "s/{nodeNum}/${i}/g" -e "s/{orgName}/${orgName}/g" $DEPLOYMENTS/orderer/fabric-orderer-template.yaml >  $DEPLOYMENTS/orderer/fabric-orderer${i}.yaml 
        kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/orderer/fabric-orderer${i}.yaml
        res=$?
        verifyResult $res "Starting orderer node ${i} failed!"
        echo
        echo "========= Started orderer node ${i} =============="
        updateHlfStatus "Inprogress" "Started orderer node ${i}"
      done
  else
      for ((i=1;i<=$nodeCount;i++));
      do
        sed -e "s/{nodeNum}/${i}/g" -e "s/{orgName}/${orgName}/g" -e "s/{domainName}/${domainName}/g" $DEPLOYMENTS/peer/fabric-peer-template-${StateDB}.yaml >  $DEPLOYMENTS/peer/fabric-peer${i}.yaml
        kubectl -n ${nodesNamespace} apply -f $DEPLOYMENTS/peer/fabric-peer${i}.yaml
        res=$?
        verifyResult $res "Starting peer node ${i} failed!"
        echo
        echo "========= Started peer node ${i} =============="
        updateHlfStatus "Inprogress" "Started peer node ${i}"
      done
  fi
}

function deployIngressConfiguration {
  createCaIngress ${domainName}
  kubectl -n ${caNamespace} apply -f /tmp/caIngress.yaml
  res=$?
  verifyResult $res "Applying ca ingress configuration failed!"
  echo
  echo "========= Successfully applied ca ingress configuration! =============="
  updateHlfStatus "Inprogress" "Successfully applied ca ingress configuration"
  
  createNodeIngress ${nodeType} ${nodeCount} ${domainName}
  kubectl -n ${nodesNamespace} apply -f /tmp/nodeIngress.yaml
  res=$?
  verifyResult $res "Applying node ingress configuration failed!"
  echo
  echo "========= Successfully applied node ingress configuration! =============="
  updateHlfStatus "Inprogress" "Successfully applied node ingress configuration"
}

kubectl create namespace ${statusNamespace}
kubectl create namespace ${caNamespace}
kubectl create namespace ${nodesNamespace}
kubectl create namespace ${adminNamespace}
kubectl create namespace ${nginxNamespace}

hlfStatus="Inprogress"
hlfDescription="Starting setup '$nodeType' HLF Org '$orgName' having '$nodeCount' nodes"
kubectl -n ${statusNamespace} create configmap hlf-status --from-literal hlfStatus="${hlfStatus}" --from-literal hlfDescription="${hlfDescription}"
res=$?
verifyResult $res "Storing Hlf status in configmap 'hlf-status' failed!"

deployFabricCA

deployNginx

waitCAServerUp "ca"
updateHlfStatus "Inprogress" "Fabric CA is UP"

echo
echo "========== Generating artifacts using Fabric CA ============"
echo
$SCRIPTS/generateCertificates.sh $orgName $nodeCount $domainName $nodeType
res=$?
verifyResult $res "Generating artifacts using Fabric CA failed!"
updateHlfStatus "Inprogress" "Generated artifacts using Fabric CA"

createManagedDisk

deployNodes

deployIngressConfiguration

exportSecret fabric-tools-secrets ${toolsNamespace} ${adminNamespace}
exportSecret hlf-ca-idcert ${caNamespace} ${adminNamespace}
exportSecret hlf-tlsca-idcert ${caNamespace} ${adminNamespace}

kubectl -n ${adminNamespace} create configmap org-detail --from-literal=orgName=${orgName} --from-literal=domainName=${domainName} --from-literal=nodeCount=${nodeCount}
res=$?
verifyResult $res "Storing ${orgName} organization metadata in configmap failed!"
echo
echo "========= Stored ${orgName} organization metadata in kubernetes configmap! =============="

updateHlfStatus "Done" "Successfully setup HLF Organization"

exit 0

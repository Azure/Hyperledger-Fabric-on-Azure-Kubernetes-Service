#!/bin/bash

. /var/hyperledger/scripts/utils.sh
. /var/hyperledger/scripts/globals.sh

ORG_NAME=$1
NODE_COUNT=$2
DOMAIN_NAME=$3
NODE_TYPE=$4
CRYPTO_PATH=/tmp/crypto-config
FABRIC_MSP_PATH=/tmp/FabricMSP
CA_ADMIN_NAME=$(cat $CA_ADMIN_USERNAME_FILE)
CA_ADMIN_PASSWORD=$(cat $CA_ADMIN_PASSWORD_FILE)
CA_CRYPTO_PATH="$CRYPTO_PATH/fabca/$ORG_NAME"
fabricToolsScriptStartTime=$5

function registerNode() {
  nodeType=$1
  nodeNum=$2
  
  if [ "$nodeType" = "orderer" ]; then
    fabric-ca-client register --id.name "orderer$nodeNum.$ORG_NAME" --id.secret ${CA_ADMIN_PASSWORD} --id.type orderer -u https://$CAServerName:$CAServerPort > /dev/null
  else
    fabric-ca-client register --id.name "peer$nodeNum.$ORG_NAME" --id.secret ${CA_ADMIN_PASSWORD} --id.type peer -u https://$CAServerName:$CAServerPort > /dev/null
  fi
  res=$?
  verifyResult $res "Registering ${nodeType}${nodeNum} failed!" "$fabricToolsScriptStartTime"
  logMessage "Info" "Registered ${nodeType}${nodeNum} for ${ORG_NAME} org" "$fabricToolsScriptStartTime"
}


function registerAdminUser() {
  fabric-ca-client register --id.name admin.$ORG_NAME --id.secret ${CA_ADMIN_PASSWORD} --id.type admin --id.attrs "hf.Registrar.Roles=*,hf.Registrar.Attributes=*,hf.Revoker=true,hf.GenCRL=true,admin=true:ecert,abac.init=true:ecert" -u https://$CAServerName:$CAServerPort > /dev/null
  res=$?
  verifyResult $res "Registering admin user for ${ORG_NAME} org failed!" "$fabricToolsScriptStartTime"
  logMessage "Info" "Registered admin user for ${ORG_NAME} org" "$fabricToolsScriptStartTime"
}

function registerAdminUserTls() {
  fabric-ca-client register --id.name admin.tls.$ORG_NAME --id.secret ${CA_ADMIN_PASSWORD} --id.type admin --id.attrs "hf.Registrar.Roles=*,hf.Registrar.Attributes=*,hf.Revoker=true,hf.GenCRL=true,admin=true:ecert,abac.init=true:ecert" -u https://$CAServerName:$CAServerPort > /dev/null
  res=$?
  verifyResult $res "Registering admin user TLS for ${ORG_NAME} org failed!" "$fabricToolsScriptStartTime"
  logMessage "Info" "Registered admin user TLS for ${ORG_NAME} org" "$fabricToolsScriptStartTime"
}

function enrollNode() {
  nodeType=$1
  nodeNum=$2
  
  logMessage "Info" "Generating enrollement certificates for ${nodeType}${nodeNum}" "$fabricToolsScriptStartTime"

  rm -rf $FABRIC_MSP_PATH/*
  export FABRIC_CA_CLIENT_MSPDIR=$FABRIC_MSP_PATH

  fabric-ca-client enroll -u https://${nodeType}${nodeNum}.${ORG_NAME}:${CA_ADMIN_PASSWORD}@$CAServerName:$CAServerPort  --csr.names "O=$ORG_NAME"
  res=$?
  if [ $res -ne 0 ]; then
    logMessage "Error" "Generating enrollement certificate for ${nodeType}${nodeNum} failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  # Store certificates in secrets
  NODE_CERT=$(ls $FABRIC_MSP_PATH/signcerts/*pem)
  executeKubectlWithRetry "kubectl -n ${nodesNamespace} create secret generic hlf${nodeType}${nodeNum}-idcert --from-file=cert.pem=$NODE_CERT" "Storing ${nodeType}${nodeNum} Enrollement certificate in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
  if [ $res -ne 0 ]; then
    logMessage "Error" "Storing ${nodeType}${nodeNum} Enrollement certificate in secrets failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  # Store key in secrets
  NODE_KEY=$(ls $FABRIC_MSP_PATH/keystore/*_sk)
  executeKubectlWithRetry "kubectl -n ${nodesNamespace} create secret generic hlf${nodeType}${nodeNum}-idkey --from-file=key.pem=$NODE_KEY" "Storing ${nodeType}${nodeNum} Enrollement private key in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
  if [ $res -ne 0 ]; then
    logMessage "Error" "Storing ${nodeType}${nodeNum} Enrollement private key in secrets failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  logMessage "Info" "Generated enrollement certificate for ${nodeType}${nodeNum}" "$fabricToolsScriptStartTime"
 
  # Delete certificates from $FABRIC_MSP_PATH
  rm -rf $FABRIC_MSP_PATH/*
}

function enrollAdminUser() {
    rm -rf $FABRIC_MSP_PATH/*
    export FABRIC_CA_CLIENT_MSPDIR=$FABRIC_MSP_PATH
    fabric-ca-client enroll -u https://admin.$ORG_NAME:${CA_ADMIN_PASSWORD}@$CAServerName:$CAServerPort --csr.names "O=$ORG_NAME"
    res=$?
    if [ $res -ne 0 ]; then
      logMessage "Error" "Generating enrollement certificate for admin user failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi
    
    # Store certificates in secrets
    ADMIN_CERT=$(ls $FABRIC_MSP_PATH/signcerts/*pem)
    executeKubectlWithRetry "kubectl -n ${adminNamespace} create secret generic hlf-admin-idcert --from-file=cert.pem=$ADMIN_CERT" "Storing Admin user Enrollement certificate in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
    if [ $res -ne 0 ]; then
      logMessage "Error" "Storing Admin user Enrollement certificate in secrets failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi
    
    # Store key in secrets
    ADMIN_KEY=$(ls $FABRIC_MSP_PATH/keystore/*_sk)
    executeKubectlWithRetry "kubectl -n ${adminNamespace} create secret generic hlf-admin-idkey --from-file=key.pem=$ADMIN_KEY" "Storing Admin user Enrollement private key in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
    if [ $res -ne 0 ]; then
      logMessage "Error" "Storing Admin user Enrollement private key in secrets failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi

    logMessage "Info" "Generated enrollement certificate for admin user" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
}

function enrollAdminUserTLS() {
    rm -rf $FABRIC_MSP_PATH/*
    export FABRIC_CA_CLIENT_MSPDIR=$FABRIC_MSP_PATH
    fabric-ca-client enroll -u https://admin.tls.$ORG_NAME:${CA_ADMIN_PASSWORD}@$CAServerName:$CAServerPort --csr.names "O=$ORG_NAME" --enrollment.profile tls
    res=$?
    if [ $res -ne 0 ]; then
      logMessage "Error" "Generating TLS certificate for admin user failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi

    # Store certificates in secrets
    ADMIN_CERT=$(ls $FABRIC_MSP_PATH/signcerts/*pem)
    executeKubectlWithRetry "kubectl -n ${adminNamespace} create secret generic hlf-admin-tls-idcert --from-file=cert.pem=$ADMIN_CERT" "Storing Admin user TLS certificate in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
    if [ $res -ne 0 ]; then
      logMessage "Error" "Storing Admin user TLS certificate in secrets failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi

    # Store key in secrets
    ADMIN_KEY=$(ls $FABRIC_MSP_PATH/keystore/*_sk)
    executeKubectlWithRetry "kubectl -n ${adminNamespace} create secret generic hlf-admin-tls-idkey --from-file=key.pem=$ADMIN_KEY" "Storing Admin user TLS private key in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
    if [ $res -ne 0 ]; then
      logMessage "Error" "Storing Admin user TLS private key in secrets failed" "$fabricToolsScriptStartTime"
      rm -rf $FABRIC_MSP_PATH/*
      exit 1
    fi

    logMessage "Info" "Generated TLS certificate for admin user" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
}

function enrollNodeTLS() {
  nodeType=$1
  nodeNum=$2
 
  logMessage "Info" "Generating TLS certifiate for ${nodeType}${nodeNum}" "$fabricToolsScriptStartTime"

  rm -rf $FABRIC_MSP_PATH/*
  export FABRIC_CA_CLIENT_MSPDIR=$FABRIC_MSP_PATH
  fabric-ca-client enroll -u https://${nodeType}${nodeNum}.${ORG_NAME}:${CA_ADMIN_PASSWORD}@$CAServerName:$CAServerPort --enrollment.profile tls --csr.hosts "${nodeType}$i,${nodeType}$i.$DOMAIN_NAME"
  res=$?
  if [ $res -ne 0 ]; then
    logMessage "Error" "Generating TLS certificate for ${nodeType}${nodeNum} failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  # Store certificates in secrets
  NODE_TLS_CERT=$(ls $FABRIC_MSP_PATH/signcerts/*pem)
  executeKubectlWithRetry "kubectl -n ${nodesNamespace} create secret generic hlf${nodeType}${nodeNum}-tls-idcert --from-file=server.crt=$NODE_TLS_CERT" "Storing ${nodeType}${nodeNum} TLS certificate in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
  if [ $res -ne 0 ]; then
    logMessage "Error" "Storing ${nodeType}${nodeNum} TLS certificate in secrets failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  # Store key in secrets
  NODE_TLS_KEY=$(ls $FABRIC_MSP_PATH/keystore/*_sk)
  executeKubectlWithRetry "kubectl -n ${nodesNamespace} create secret generic hlf${nodeType}${nodeNum}-tls-idkey --from-file=server.key=$NODE_TLS_KEY" "Storing ${nodeType}${nodeNum} TLS private key in secrets failed" "$fabricToolsScriptStartTime" "no-verifyResult"
  if [ $res -ne 0 ]; then
    logMessage "Error" "Storing ${nodeType}${nodeNum} TLS private key in secrets failed" "$fabricToolsScriptStartTime"
    rm -rf $FABRIC_MSP_PATH/*
    exit 1
  fi

  if [ "$nodeType" == "orderer" ]; then
    #store public key in folder for genesis block generation
    mkdir -p $ORG_CRYPTO_PATH/orderers/orderer${nodeNum}/tls
    cp $FABRIC_MSP_PATH/signcerts/*.pem $ORG_CRYPTO_PATH/orderers/orderer${nodeNum}/tls/server.crt
  fi

  logMessage "Info" "Generated TLS certificate for ${nodeType}${nodeNum}" "$fabricToolsScriptStartTime"
  rm -rf $FABRIC_MSP_PATH/*
}

rm -rf $CRYPTO_PATH
mkdir -p $CA_CRYPTO_PATH/{ca-admin,ca-server,tlsca-admin,tlsca-server}
rm -rf $FABRIC_MSP_PATH
mkdir -p $FABRIC_MSP_PATH

if [ "$NODE_TYPE" = "orderer" ]; then
  ORG_CRYPTO_PATH="$CRYPTO_PATH/ordererOrganizations/$ORG_NAME/"
else
  ORG_CRYPTO_PATH="$CRYPTO_PATH/peerOrganizations/$ORG_NAME/"
fi

# ---------------------------------------------------
# Enroll fabric CA admin
# ---------------------------------------------------
export FABRIC_CA_CLIENT_HOME=$CA_CRYPTO_PATH/ca-admin
export FABRIC_CA_CLIENT_TLS_CERTFILES=/tmp/fabric-ca/tls-certfile/rca.pem
# maximum retry attempt to connect to fabric-ca
MAX_RETRY_COUNT=10
for ((retryCount=1;retryCount<=$MAX_RETRY_COUNT;retryCount++));
do
  echo "Attempt $retryCount: Enrolling Fabric CA admin" $FABRIC_CA_CLIENT_HOME
  fabric-ca-client enroll -u https://$CA_ADMIN_NAME:$CA_ADMIN_PASSWORD@${CAServerName}:${CAServerPort}
  res=$?
  if [ $res -eq 0 ]
  then
    break
  fi
  sleep 30
done
verifyResult $res "Enrolling Fabric CA Admin Failed!" "$fabricToolsScriptStartTime"
logMessage "Info" "Enrolled Fabric CA Admin!" "$fabricToolsScriptStartTime"

# ---------------------------------------------------
# Register nodes
# ---------------------------------------------------
for ((i=1;i<=$NODE_COUNT;i++));
do
    registerNode $NODE_TYPE $i
done

# ---------------------------------------------------
# Register admin user
# ---------------------------------------------------
registerAdminUser
registerAdminUserTls

# ---------------------------------------------------
# Enroll each node
# ---------------------------------------------------
for ((i=1;i<=$NODE_COUNT;i++));
do
   enrollNode $NODE_TYPE $i
done

# ---------------------------------------------------
# Enroll admin user
# ---------------------------------------------------
enrollAdminUser

# ---------------------------------------------------
# Org MSP
# ---------------------------------------------------
logMessage "Info" "Generate Organization MSP" "$fabricToolsScriptStartTime"
mkdir -p $ORG_CRYPTO_PATH/msp/{cacerts,tlscacerts,admincerts}

# cacerts --orderer
export FABRIC_CA_CLIENT_HOME=$CA_CRYPTO_PATH/ca-admin
export FABRIC_CA_CLIENT_MSPDIR=""
fabric-ca-client getcacert -u https://${CAServerName}:${CAServerPort} -M $ORG_CRYPTO_PATH/msp
res=$?
verifyResult $res "Fetching CA Certificates from Fabric CA failed!" "$fabricToolsScriptStartTime"

# AdminCerts --orderer
fabric-ca-client identity list
fabric-ca-client certificate list --id admin.$ORG_NAME --store $ORG_CRYPTO_PATH/msp/admincerts
res=$?
verifyResult $res "Fetching Admin user Certificates from Fabric CA Failed!" "$fabricToolsScriptStartTime"

# ---------------------------------------------------
# Enroll each node
# ---------------------------------------------------
for ((i=1;i<=$NODE_COUNT;i++));
do
    enrollNodeTLS $NODE_TYPE $i
done

# ---------------------------------------------------
# Enroll admin user
# ---------------------------------------------------
enrollAdminUserTLS

# fetch tlscacerts
export FABRIC_CA_CLIENT_HOME=$CA_CRYPTO_PATH/tlsca-admin
export FABRIC_CA_CLIENT_MSPDIR=""
fabric-ca-client getcacert -u https://${CAServerName}:${CAServerPort} -M $ORG_CRYPTO_PATH/msp --enrollment.profile tls
res=$?
verifyResult $res "Fetching TLSCA Certificates from Fabric CA failed!" "$fabricToolsScriptStartTime"

# Store certificates in secrets
TLSCA_CERT=$(ls $ORG_CRYPTO_PATH/msp/tlscacerts/*pem)
executeKubectlWithRetry "kubectl -n ${caNamespace} create secret generic hlf-tlsca-idcert --from-file=ca.crt=$TLSCA_CERT" "Storing TLSCA Certificates in kubernetes secrets failed!" "$fabricToolsScriptStartTime" "verifyResult"
logMessage "Info" "Stored Org TLSCA certificates in kubernetes store!" "$fabricToolsScriptStartTime"

# delete keystore and signcerts empty dir
rm -rf $ORG_CRYPTO_PATH/msp/{keystore,signcerts,user}
# Done with generating certificates. Delete Fabric CA admin certificates
rm -rf $CA_CRYPTO_PATH

#!/bin/bash

# This script will orchestrate the creation of Hyperledger
# Fabric network.  

CHAINCODE_NAME="mycc"
VERSION="1.0"
LANGUAGE="golang"
LOG_FILE="/tmp/log.txt"
DELAY=3
MAX_RETRY=10
COUNTER=1
ADMIN_TLS_CERTFILE=/var/hyperledger/peer/tls/cert.pem
ADMIN_TLS_KEYFILE=/var/hyperledger/peer/tls/key.pem

#import utils
. ./utils.sh

# Print the usage message
function printHelp() {
    echo "Usage: "
    echo "  byn.sh [command] [arguments] [-h]"
    echo "  Available commands:"
    echo "   uploadOrgMSP             - upload organization MSP on azure storage"
    echo "   addPeerInConsortium      - add a peer organization to the consortium"
    echo "   createChannel            - create a new channel with only orderer organization"
    echo "   addPeerInChannel         - add peer organization to the channel"
    echo "   joinNodesInChannel       - join peer nodes in the channel"
    echo "   updateAnchorPeer         - update anchor peer of peer organization"
    echo "   installDemoChaincode     - install chaincode on a peer node"
    echo "   instantiateDemoChaincode - instantiate chaincode on a channel"
    echo "   invokeDemoChaincode      - invoke chaincode function on a channel"
    echo "   queryDemoChaincode       - query chaincode function on a peer node"
    echo "    -h   print this message"
    echo ""
    echo "Use \"byn.sh <command> -h\" for more information about a command."
    echo
    echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

function printUploadOrgMSPHelp() {
  echo "Usage: "
  echo "  byn.sh uploadOrgMSP <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh uploadOrgMSP \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh uploadOrgMSP -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printAddPeerInConsortiumHelp() {
  echo "Usage: "
  echo "  byn.sh addPeerInConsortium <peerOrgName> <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh addPeerInConsortium \"org1\" \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh addPeerInConsortium -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printCreateChannelHelp() {
  echo "Usage: "
  echo "  byn.sh createChannel <channelName>"
  echo ""
  echo "Example:"
  echo "byn.sh createChannel \"mychannel\""
  echo ""
  echo "byn.sh createChannel -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printJoinNodesInChannelHelp() {
  echo "Usage: "
  echo "  byn.sh joinNodesInChannel <channelName> <ordererAddress> <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh joinNodesInChannel \"mychannel\" \"orderer1.5ef38927f80e49d5b0de.southeastasia.aksapp.io:443\" \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh joinNodesInChannel -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printUpdateAnchorPeerHelp() {
  echo "Usage: "
  echo "  byn.sh updateAnchorPeer <commaSeperatedListofPeerNodesName> <channelName> <ordererAddress> <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh updateAnchorPeer \"peer1\" \"mychannel\" \"orderer1.5ef38927f80e49d5b0de.southeastasia.aksapp.io:443\" \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh updateAnchorPeer -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printInstallDemoChaincodeHelp() {
  echo "Usage: "
  echo "  byn.sh installDemoChaincode <peerNodeName>"
  echo ""
  echo "Example:"
  echo "byn.sh installDemoChaincode \"peer1\""
  echo ""
  echo "byn.sh installDemoChaincode -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for steps to run command"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printInstantiateDemoChaincodeHelp() {
  echo "Usage: "
  echo "  byn.sh instantiateDemoChaincode <peerNodeName> <channelName> <ordererAddress> <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh instantiateDemoChaincode \"peer1\" \"mychannel\" \"orderer1.5ef38927f80e49d5b0de.southeastasia.aksapp.io:443\" \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh instantiateDemoChaincode -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printInvokeDemoChaincodeHelp() {
  echo "Usage: "
  echo "  byn.sh invokeDemoChaincode <peerNodeName> <channelName> <ordererAddress> <storageURI-with-SAStoken>"
  echo ""
  echo "Example:"
  echo "byn.sh invokeDemoChaincode \"peer1\" \"mychannel\" \"orderer1.5ef38927f80e49d5b0de.southeastasia.aksapp.io:443\" \"https://[account].file.core.windows.net/[file-share]?[SAS]\""
  echo ""
  echo "byn.sh invokeDemoChaincode -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

printQueryDemoChaincodeHelp() {
  echo "Usage: "
  echo "  byn.sh queryDemoChaincode <peerNodeName> <channelName>"
  echo ""
  echo "Example:"
  echo "byn.sh queryDemoChaincode \"peer1\" \"mychannel\""
  echo ""
  echo "byn.sh queryDemoChaincode -h   print this message"
  echo
  echo "Refer 'https://aka.ms/aks-hlftemplate-user-guide' link for detailed user guide"
}

function verifyURI() {
  URI=$1
  if [[ ! "$URI" =~ ^https://.*\.file\.core\.windows\.net/.*?.*$ ]]; then
    echo "Invalid Storage URI!!!"
    exit 1
  fi 
}

uploadOrgMSP() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printUploadOrgMSPHelp
      exit 0
      ;;
    esac
  done

  if [ $# -ne 1 ]; then
      echo "Invalid number of arguments"
      printUploadOrgMSPHelp
      exit 1
  fi

  storageURI=$1
  orgName=${HLF_ORG_NAME} 
  
  verifyTool azcopy
  verifyURI $storageURI
  
  #Copy all required public certificates to /tmp folder for uploading on storage URI
  rm -rf /tmp/${orgName}
  mkdir -p /tmp/${orgName}/msp/{cacerts,admincerts,tlscacerts}
  cp /var/hyperledger/peer/msp/admincerts/*.pem /tmp/${orgName}/msp/admincerts/
  cp /var/hyperledger/peer/msp/cacerts/*.pem /tmp/${orgName}/msp/cacerts/
  cp /var/hyperledger/peer/msp/tlscacerts/*.crt /tmp/${orgName}/msp/tlscacerts/
  
  azcopy copy "/tmp/${orgName}" "$storageURI" --recursive &> $LOG_FILE
  res=$?
  verifyResult $res "Uploading MSP to storage failed"
  echo "========= Uploaded ${orgName} MSP to storage ! =========== "
  #remove temporary copy of MSP 
  rm -rf /tmp/${orgName}/msp
}

fetchChannelConfig() {
  CHANNEL=$1
  OUTPUT=$2

  setPeerGlobals 1

  echo "Fetching the most recent configuration block for the channel"
  set -x
  peer channel fetch config config_block.pb -o ${ORDERER_ADDRESS} -c $CHANNEL --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  cat $LOG_FILE
  verifyResult $res "Fetching Genesis block for the channel '${CHANNEL}' from '${ORDERER_ADDRESS}' orderer failed"
  
  echo "Decoding config block to JSON and isolating config to ${OUTPUT}"
  configtxlator proto_decode --input config_block.pb --type common.Block > config_common_block.json 2> $LOG_FILE
  res=$?
  verifyResult $res "Decoding config block to JSON failed"
  jq .data.data[0].payload.data.config config_common_block.json >"${OUTPUT}"
}

handleAddNewPeerOrg() {
  ORDERER_TLS_CA=/var/hyperledger/peer/msp/tlscacerts/ca.crt
  ORDERER_ADDRESS="orderer1.${HLF_DOMAIN_NAME}:443"
  PEER_ORG_NAME=$1
  CHANNEL_NAME=$2
  STORAGE_URI=$3

  echo "============= Downloading ${PEER_ORG_NAME} MSP ==============="
  rm -rf /tmp/hlf
  mkdir -p /tmp/hlf
  cd /tmp/hlf
  downloadPeerMSP ${PEER_ORG_NAME} ${STORAGE_URI} "/tmp/hlf"


  echo "============ Generating ${PEER_ORG_NAME} config material ============="
  (
  export FABRIC_CFG_PATH=$PWD
  sed -e "s/{ORG_NAME}/${PEER_ORG_NAME}/g" /var/hyperledger/consortiumScripts/configtx-template.yaml > ./configtx.yaml

  configtxgen -printOrg ${PEER_ORG_NAME} > ${PEER_ORG_NAME}.json 2> $LOG_FILE
  res=$?
  verifyResult $res "Failed to generate ${PEER_ORG_NAME} config material"
  )

  echo
  echo "========= Creating config transaction to add '${PEER_ORG_NAME}' to consortium =========== "
  echo
  # Fetch the config for the channel, writing it to config.json
  fetchChannelConfig ${CHANNEL_NAME} config.json


  # Modify the configuration to append the new org
  jq -s ".[0] * {\"channel_group\":{\"groups\":{\"Consortiums\":{\"groups\": {\"SampleConsortium\": {\"groups\": {\"${PEER_ORG_NAME}\":.[1]}}}}}}}" config.json ${PEER_ORG_NAME}.json > modified_config.json
  res=$?
  verifyResult $res "Failed to create new confguration block"

  echo
  echo "========= Compute config update based on difference between current and new configuration =========== "
  echo
  # Compute a config update, based on the differences between config.json and modified_config.json, write it as a transaction to {PEER_ORG_NAME}_update_in_envelope.pb
  createConfigUpdate ${CHANNEL_NAME} config.json modified_config.json ${PEER_ORG_NAME}_update_in_envelope.pb

  echo
  echo "========= Config transaction to add ${PEER_ORG_NAME} to network created ===== "
  echo

  echo
  echo "========= Submitting transaction from orderer admin which signs it as well ========= "
  echo
  set -x
  peer channel update -f ${PEER_ORG_NAME}_update_in_envelope.pb -c ${CHANNEL_NAME} -o ${ORDERER_ADDRESS} --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  cat $LOG_FILE
  verifyResult $res "peer channel update transaction failed"

  echo
  echo "========= Config transaction to add ${PEER_ORG_NAME} to network submitted! =========== "
  echo

  #Upload Orderer TLS CA on azure storage
  mkdir -p /tmp/hlf/orderer/tlscacerts
  cp ${ORDERER_TLS_CA} /tmp/hlf/orderer/tlscacerts/
  ordererTLSStorageURI="$FileShare/${PEER_ORG_NAME}?$SASToken"
  azcopy copy "/tmp/hlf/orderer" $ordererTLSStorageURI --recursive &> $LOG_FILE
  res=$?
  verifyResult $res "orderer TLS root certificate upload to '${FileShare}' file storage failed"
  echo
  echo "========= Uploaded orderer TLS root certificate at '${FileShare}' file storage =========== "
  echo
}

addPeerInConsortium() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printAddPeerInConsortiumHelp
      exit 0
      ;;
    esac
  done

  if [ $# -ne 2 ]; then
      echo "Invalid number of arguments!!!"
      printAddPeerInConsortiumHelp
      exit 1
  fi

  peerOrgName=$1
  storageURI=$2

  verifyTool configtxgen
  verifyTool configtxlator
  verifyTool jq
  verifyTool azcopy
  verifyURI $storageURI

  handleAddNewPeerOrg $peerOrgName "testchainid" $storageURI
}

channelCreate() {
  CHANNEL_NAME=$1
  ORDERER_ADDRESS="orderer1.${HLF_DOMAIN_NAME}:443"

  setPeerGlobals 1
  ORDERER_TLS_CA="/var/hyperledger/peer/msp/tlscacerts/ca.crt"
  set -x
  peer channel create -o $ORDERER_ADDRESS -c $CHANNEL_NAME -f ./channel.tx --tls --cafile $ORDERER_TLS_CA --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  verifyResult $res "Channel creation failed"
  cat $LOG_FILE
  echo
  echo "===================== Channel '$CHANNEL_NAME' created ===================== "
  echo
}

createChannel() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printCreateChannelHelp
      exit 0
      ;;
    esac
  done

  if [ $# -ne 1 ]; then
      echo "Invalid number of arguments!!!"
      printCreateChannelHelp
      exit 1
  fi
  channelName=$1
  

  if [[ ! "$channelName" =~ ^[a-z][a-z0-9.-]*$ ]]; then
     echo "Invalid character in channel name!!!!"
     echo "Only 'a-z','0-9','.' and '-' is allowed in channel name!!!" 
     exit 1
  fi

  if [ "$channelName" == "testchainid" ]; then
     echo "Invalid channel name!!!!"
     exit 1
  fi
 
  verifyTool configtxgen

  cd /var/hyperledger/peer

  sed -e "s/{ORG_NAME}/${HLF_ORG_NAME}/g" /var/hyperledger/consortiumScripts/configtx-template.yaml > ./configtx.yaml
  echo
  echo "========= Generating channel configuration transaction ============"
  echo
  configtxgen -profile SampleChannel -outputCreateChannelTx ./channel.tx -channelID $channelName -configPath /var/hyperledger/peer 2> $LOG_FILE
  res=$?
  verifyResult $res "Failed to generate channel configuration transaction"

  channelCreate $channelName
}

joinNodesInChannel() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printJoinNodesInChannelHelp
      exit 0
      ;;
    esac
  done

  if [ $# -ne 3 ]; then
      echo "Invalid number of arguments!!!"
      printJoinNodesInChannelHelp
      exit 1
  fi

  CHANNEL_NAME=$1
  ORDERER_ADDRESS=$2
  storageURI=$3
  
  rm -rf /tmp/hlf
  mkdir -p /tmp/hlf
  # download Orderer TLS CA to local directory
  downloadOrdererTLS $storageURI "/tmp/hlf"

  ORDERER_TLS_CA="/tmp/hlf/orderer/tlscacerts/ca.crt"
  setPeerGlobals 1
  set -x
  peer channel fetch 0 ${CHANNEL_NAME}.block -o ${ORDERER_ADDRESS} -c $CHANNEL_NAME --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  cat $LOG_FILE
  verifyResult $res "Fetching '${CHANNEL_NAME}' channel genesis block failed"

  echo
  echo "======== Fetched genesis block of the channel ${CHANNEL_NAME} ==========="
  echo

  for ((i=1;i<=$HLF_NODE_COUNT;i++));
  do
     joinChannelWithRetry $i $CHANNEL_NAME
  done
}

prepareAnchorPeerJson()
{
  OLDIFS=$IFS
  IFS=, anchorPeers=($1)
  IFS=$OLDIFS
  lastPeerIndex=$((${#anchorPeers[@]} - 1))
  {
  echo '{"mod_policy": "Admins","value": {"anchor_peers": ['
  for (( i=0; i<${#anchorPeers[@]}; i++ ))
  do
  echo '{"host": "'${anchorPeers[$i]}.${HLF_DOMAIN_NAME}'","port": 443'
  if [ $i -eq ${lastPeerIndex} ]; then
       echo '}'
  else
       echo '},'
  fi
  done
  echo ']},"version": "0"}'
  } > ./anchorPeer.json
}

updateAnchorPeer() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printUpdateAnchorPeerHelp
      exit 0
      ;;
    esac
  done

  if [ $# -ne 4 ]; then
      echo "Invalid number of arguments!!!"
      printUpdateAnchorPeerHelp
      exit 1
  fi

  ANCHOR_PEER_LIST=$1
  CHANNEL_NAME=$2
  ORDERER_ADDRESS=$3
  storageURI=$4

  rm -rf /tmp/hlf
  mkdir -p /tmp/hlf
  # download Orderer TLS CA to local directory
  downloadOrdererTLS $storageURI "/tmp/hlf"

  ORDERER_TLS_CA="/tmp/hlf/orderer/tlscacerts/ca.crt"
  setPeerGlobals 1
  echo
  echo "========= Creating config transaction to update anchor peer for '${HLF_ORG_NAME}' for channel '${CHANNEL_NAME}' =========== "
  echo
  # Fetch the config for the channel, writing it to config.json
  fetchChannelConfig ${CHANNEL_NAME} config.json

  prepareAnchorPeerJson $ANCHOR_PEER_LIST 
 
  # Modify the configuration to append the new org
  jq -s ".[0] * {\"channel_group\":{\"groups\":{\"Application\":{\"groups\": {\"${HLF_ORG_NAME}\":{\"values\":{\"AnchorPeers\":.[1]}}}}}}}" config.json anchorPeer.json > modified_config.json
  res=$?
  verifyResult $res "Failed to generate new configuration block"

  echo
  echo "========= Compute config update based on difference between current and new configuration =========== "
  echo
  # Compute a config update, based on the differences between config.json and modified_config.json, write it as a transaction to org3_update_in_envelope.pb
  createConfigUpdate ${CHANNEL_NAME} config.json modified_config.json ${HLF_ORG_NAME}_update_in_envelope.pb

  echo
  echo "========= Config transaction to update '${HLF_ORG_NAME}' anchor peer created ===== "
  echo
  echo
  echo "========= Submitting transaction from peer admin which signs it as well ========= "
  echo
  set -x
  peer channel update -f ${HLF_ORG_NAME}_update_in_envelope.pb -c ${CHANNEL_NAME} -o ${ORDERER_ADDRESS} --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  cat $LOG_FILE
  verifyResult $res "peer channel update transaction failed"

  echo
  echo "========= Config transaction to update '${HLF_ORG_NAME}' anchor peer for channel '${CHANNEL_NAME}' submitted! =========== "
  echo
}

verifyPeerName()
{
  peer=$1
  if [[ ! "$peer" =~ ^peer[1-9]{1,2}$ ]]; then
    echo "Invalid Peer Name!!! Valid format is \"peer<peer#>\""
    exit 1
  fi 
  
  peerNum=$(echo $peer | tr -d -c 0-9)
  if [ $peerNum -gt $HLF_NODE_COUNT ]; then
      echo "Invalid Peer Number!! It has only \"peer1\" to \"Peer${HLF_NODE_COUNT}\" peer nodes..."
      exit 1
  fi
}

installDemoChaincode() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printInstallDemoChaincodeHelp
      exit 0
      ;;
    esac
  done


  if [ $# -ne 1 ]; then
      echo "Invalid number of arguments!!!"
      printInstallDemoChaincodeHelp
      exit 1
  fi
  peer=$1
  verifyPeerName $peer

  peerNum=$(echo $peer | tr -d -c 0-9)
  setPeerGlobals $peerNum
  set +e
  result=$(peer chaincode list --installed | grep "${CHAINCODE_NAME}")
  set -e
  if [ -z "$result" ]; then
    handleInstallChaincode $peerNum
  else
    echo
    echo "========== Skipping chaincode installation. It is already installed! ========"
    echo
  fi
}

instantiateDemoChaincode() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printInstantiateDemoChaincodeHelp
      exit 0
      ;;
    esac
  done


  if [ $# -ne 4 ]; then
      echo "Invalid number of arguments!!!"
      printInstantiateDemoChaincodeHelp
      exit 1
  fi
  peer=$1
  channelName=$2
  ordererAddress=$3
  storageURI=$4
  
  verifyURI $storageURI
  verifyTool azcopy
  verifyPeerName $peer
  
  peerNum=$(echo $peer | tr -d -c 0-9)
  setPeerGlobals $peerNum
  set +e
  result=$(peer chaincode list --instantiated -C $channelName | grep "${CHAINCODE_NAME}")
  set -e
  if [ -z "$result" ]; then
    #Download orderer TLS from storage account to local directory
    rm -rf /tmp/hlf
    mkdir -p /tmp/hlf
    downloadOrdererTLS $storageURI "/tmp/hlf"
    ordererTlsCA="/tmp/hlf/orderer/tlscacerts/ca.crt"
    handleInstantiateChaincode $peerNum $channelName $ordererAddress $ordererTlsCA
  else
    echo "======== Skipping chaincode instantiation. It is already instantiated! ================"
  fi
}

invokeDemoChaincode() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printInvokeDemoChaincodeHelp
      exit 0
      ;;
    esac
  done


  if [ $# -ne 4 ]; then
      echo "Invalid number of arguments!!!"
      printInvokeDemoChaincodeHelp
      exit 1
  fi
  peer=$1
  channelName=$2
  ordererAddress=$3
  storageURI=$4

  verifyPeerName $peer
  verifyURI $storageURI

  peerNum=$(echo $peer | tr -d -c 0-9)

  #Download orderer TLS from storage account to local directory
  rm -rf /tmp/hlf
  mkdir -p /tmp/hlf
  downloadOrdererTLS $storageURI "/tmp/hlf"
  ordererTlsCA="/tmp/hlf/orderer/tlscacerts/ca.crt"

  chaincodeInvoke $peerNum $channelName $ordererAddress $ordererTlsCA
}

queryDemoChaincode() {
  while getopts ":h" opt; do
    case "$opt" in
    h | \?)
      printQueryDemoChaincodeHelp
      exit 0
      ;;
    esac
  done


  if [ $# -ne 2 ]; then
      echo "Invalid number of arguments!!!"
      printQueryDemoChaincodeHelp
      exit 1
  fi

  peer=$1
  channelName=$2
  verifyPeerName $peer
  peerNum=$(echo $peer | tr -d -c 0-9)

  chaincodeQuery $peerNum $channelName 
}

addPeerInChannel() {
  PEER_ORG_NAME=$1
  CHANNEL_NAME=$2
  ORDERER_ADDRESS="orderer1.${HLF_DOMAIN_NAME}:443"
  STORAGE_URI=$3

  echo "============ Downloading ${PEER_ORG_NAME} MSP ==============="
  echo
  mkdir -p /tmp/hlf
  cd /tmp/hlf
  downloadPeerMSP ${PEER_ORG_NAME} ${STORAGE_URI} "/tmp/hlf"

  echo "========== Generating ${PEER_ORG_NAME} config material ========="
  echo
  (
  export FABRIC_CFG_PATH=$PWD
  sed -e "s/{ORG_NAME}/${PEER_ORG_NAME}/g" /var/hyperledger/consortiumScripts/configtx-template.yaml > ./configtx.yaml

  configtxgen -printOrg ${PEER_ORG_NAME} > ${PEER_ORG_NAME}.json 2> $LOG_FILE
  res=$?
  verifyResult $res "Failed to generate ${PEER_ORG_NAME} config material in JOSN format"
  )

  ORDERER_TLS_CA="/var/hyperledger/peer/msp/tlscacerts/ca.crt"

  echo
  echo "========= Creating config transaction to add ${PEER_ORG_NAME} to channel '${CHANNEL_NAME}' =========== "
  echo
  # Fetch the config for the channel, writing it to config.json
  fetchChannelConfig ${CHANNEL_NAME} config.json


  # Modify the configuration to append the new org
  jq -s ".[0] * {\"channel_group\":{\"groups\":{\"Application\":{\"groups\": {\"${PEER_ORG_NAME}\":.[1]}}}}}" config.json ${PEER_ORG_NAME}.json > modified_config.json
  res=$?
  verifyResult $res "Failed to generate new configuration block"

  echo
  echo "========= Compute config update based on difference between current and new configuration =========== "
  echo
  # Compute a config update, based on the differences between config.json and modified_config.json, write it as a transaction to org3_update_in_envelope.pb
  createConfigUpdate ${CHANNEL_NAME} config.json modified_config.json ${PEER_ORG_NAME}_update_in_envelope.pb

  echo
  echo "========= Config transaction to add ${PEER_ORG_NAME} to channel created ===== "
  echo

  echo
  echo "========= Submitting transaction from orderer admin which signs it as well ========= "
  echo
  set -x
  peer channel update -f ${PEER_ORG_NAME}_update_in_envelope.pb -c ${CHANNEL_NAME} -o ${ORDERER_ADDRESS} --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE &> $LOG_FILE
  res=$?
  set +x
  cat $LOG_FILE
  verifyResult $res "peer channel update transaction failed"

  echo
  echo "========= Config transaction to add ${PEER_ORG_NAME} to channel ${CHANNEL_NAME} submitted! =========== "
  echo

  ordererTLSStorageURI="$FileShare/${PEER_ORG_NAME}?$SASToken"
  mkdir -p /tmp/hlf/orderer/tlscacerts
  cp /var/hyperledger/peer/msp/tlscacerts/ca.crt /tmp/hlf/orderer/tlscacerts/
  azcopy copy "/tmp/hlf/orderer" $ordererTLSStorageURI --recursive &> $LOG_FILE
  res=$?
  verifyResult $res "Orderer TLS root certificate upload to '${FileShare}' file storage failed"
  echo
  echo "=========== Uploaded Orderer TLS Root certificate to '${FileShare}' File storage! =========== "
  echo
}

while getopts ":h" opt; do
  case "$opt" in
  h | \?)
    printHelp
    exit 0
    ;;
  esac
done

COMMAND=$1
shift

if [ "${COMMAND}" == "uploadOrgMSP" ]; then
  uploadOrgMSP "$@"
elif [ "${COMMAND}" == "addPeerInConsortium" ]; then 
  addPeerInConsortium "$@"
elif [ "${COMMAND}" == "createChannel" ]; then 
  createChannel "$@"
elif [ "${COMMAND}" == "addPeerInChannel" ]; then 
  addPeerInChannel "$@"
elif [ "${COMMAND}" == "joinNodesInChannel" ]; then 
  joinNodesInChannel "$@"
elif [ "${COMMAND}" == "updateAnchorPeer" ]; then
  updateAnchorPeer "$@"
elif [ "${COMMAND}" == "installDemoChaincode" ]; then 
  installDemoChaincode "$@"
elif [ "${COMMAND}" == "instantiateDemoChaincode" ]; then 
  instantiateDemoChaincode "$@"
elif [ "${COMMAND}" == "invokeDemoChaincode" ]; then 
  invokeDemoChaincode "$@"
elif [ "${COMMAND}" == "queryDemoChaincode" ]; then 
  queryDemoChaincode "$@"
else
  echo "Invalid command!!"
  printHelp
  exit 1
fi

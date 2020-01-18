#!/bin/bash

verifyTool()
{
    toolName=$1
    which $toolName
    if [ "$?" -ne 0 ]; then
        echo "$toolName tool not found. exiting"
        exit 1
    fi
}

setPeerGlobals() {
   PEER=$1
   export CORE_PEER_LOCALMSPID="${HLF_ORG_NAME}"
   export CORE_PEER_ADDRESS="peer${PEER}.${HLF_DOMAIN_NAME}:443"
}

verifyResult() {
  if [ $1 -ne 0 ]; then
    errorLog=$(tr -d '\n' < $LOG_FILE)
    echo "======== !!! HLF SCRIPT ERROR !!! "$2" !!! RETURN CODE: "$1" !!! ERROR LOG: $errorLog !!!! ==============="
    echo
    echo "Please make sure you are following the steps as mentioned here: https://aka.ms/aks-hlftemplate-user-guide"
    echo
    exit 1
  fi
}

downloadOrdererTLS() {
  storageURI=$1
  localPath=$2
  FileShare=$(echo ${storageURI} | cut -d'?' -f1)
  SASToken=$(echo ${storageURI} | cut -d'?' -f2)
  ordererTlsURI="$FileShare/${HLF_ORG_NAME}/orderer?${SASToken}"
  azcopy copy $ordererTlsURI ${localPath} --recursive &> $LOG_FILE
  res=$?
  verifyResult $res "Downloading Orderer TLS Root Certificate from '${FileShare}' failed!!"
  echo
  echo "===================== Orderer TLS Root certificate downloaded from '${FileShare}' ===================== "
  echo
}

downloadPeerMSP() {
  PEER_ORG_NAME=$1
  storageURI=$2
  localPath=$3
  FileShare=$(echo ${storageURI} | cut -d'?' -f1)
  SASToken=$(echo ${storageURI} | cut -d'?' -f2)
  mspURI="$FileShare/${PEER_ORG_NAME}/msp?$SASToken"
  azcopy copy $mspURI $localPath --recursive &> $LOG_FILE
  res=$?
  verifyResult $res "Downloading ${PEER_ORG_NAME} MSP from '${FileShare}' failed!!"
  echo
  echo "===================== ${PEER_ORG_NAME} MSP downloaded from '${FileShare}' ===================== "
  echo
}
# createConfigUpdate <channel_id> <original_config.json> <modified_config.json> <output.pb>
# Takes an original and modified config, and produces the config update tx
# which transitions between the two
createConfigUpdate() {
  CHANNEL=$1
  ORIGINAL=$2
  MODIFIED=$3
  OUTPUT=$4

  configtxlator proto_encode --input "${ORIGINAL}" --type common.Config >original_config.pb 2> $LOG_FILE
  res=$?
  verifyResult $res "Converting original configuration block from JSON to Protobuf failed!!"

  configtxlator proto_encode --input "${MODIFIED}" --type common.Config >modified_config.pb 2> $LOG_FILE
  res=$?
  verifyResult $res "Converting modified configuration block from JSON to Protobuf failed!!"

  configtxlator compute_update --channel_id "${CHANNEL}" --original original_config.pb --updated modified_config.pb >config_update.pb 2> $LOG_FILE
  res=$?
  verifyResult $res "Computing difference between original and modified configuration block failed!!"

  configtxlator proto_decode --input config_update.pb --type common.ConfigUpdate >config_update.json 2> $LOG_FILE
  res=$?
  verifyResult $res "Converting configuration update from Protobuf to JSON failed!!"

  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL'", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' | jq . >config_update_in_envelope.json
  configtxlator proto_encode --input config_update_in_envelope.json --type common.Envelope >"${OUTPUT}" 2> $LOG_FILE
  res=$?
  verifyResult $res "Converting configuration update with envelop from JSON to Protobuf failed!!"
}

## Sometimes Join takes time hence RETRY at least 10 times
joinChannelWithRetry() {
  PEER=$1
  CHANNEL_NAME=$2

  setPeerGlobals $PEER

  set -x
  peer channel join -b $CHANNEL_NAME.block &> $LOG_FILE
  res=$?
  set +x
  if [ $res -ne 0 -a $COUNTER -lt $MAX_RETRY ]; then
    COUNTER=$(expr $COUNTER + 1)
    echo "peer${PEER} of org ${HLF_ORG_NAME} failed to join the channel, Retry after $DELAY seconds"
    sleep $DELAY
    joinChannelWithRetry $PEER $CHANNEL_NAME
  else
    COUNTER=1
  fi
  verifyResult $res "After $MAX_RETRY attempts, peer${PEER} of org ${HLF_ORG_NAME} has failed to join channel '$CHANNEL_NAME' "
  cat $LOG_FILE
  echo "===================== Peer ${PEER} successfully joined channel ${CHANNEL_NAME} ===================== "
  echo
}

generateArtifacts() {
  CHANNEL_NAME=$1

  #generate channel artifact
  cp /var/hyperledger/consortiumScripts/configtx-channel-creation.yaml ./configtx.yaml

  echo "Generating channel configuration transaction 'channel.tx'"
  configtxgen -profile SampleChannel -outputCreateChannelTx ./channel.tx -channelID $CHANNEL_NAME -configPath /var/hyperledger/peer 2> $LOG_FILE
  res=$?
  verifyResult $res "Failed to generate channel configuration transaction"
}

handleInstallChaincode() {
  PEER=$1
  setPeerGlobals $PEER

  #This path is w.r.t path set in $GOPATH
  CC_SRC_PATH="chaincode/chaincode_example02/go/"
  set -x
  peer chaincode install -n ${CHAINCODE_NAME} -v ${VERSION} -l ${LANGUAGE} -p ${CC_SRC_PATH} &> $LOG_FILE
  res=$?
  set +x
  verifyResult $res "Chaincode installation on peer${PEER} of org ${HLF_ORG_NAME} has failed"
  cat $LOG_FILE
  echo "===================== Chaincode is installed on peer${PEER} of org ${HLF_ORG_NAME} ===================== "
  echo
}

handleInstantiateChaincode() {
  PEER=$1
  CHANNEL_NAME=$2
  ORDERER_ADDRESS=$3
  ORDERER_TLS_CA=$4

  setPeerGlobals $PEER

  set -x
  peer chaincode instantiate -o "${ORDERER_ADDRESS}" --tls --cafile ${ORDERER_TLS_CA} --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE -C "${CHANNEL_NAME}" -n "${CHAINCODE_NAME}" -l ${LANGUAGE} -v ${VERSION} -c '{"Args":["init","a","1000","b","2000"]}' &> $LOG_FILE
  res=$?
  set +x
  verifyResult $res "Chaincode instantiation on peer${PEER} of org ${HLF_ORG_NAME} on channel '$CHANNEL_NAME' failed"
  cat $LOG_FILE
  echo
  echo "===================== Chaincode is instantiated on peer${PEER} of org ${HLF_ORG_NAME} on channel '$CHANNEL_NAME' ===================== "
  echo
}

chaincodeInvoke() {
  PEER=$1
  CHANNEL_NAME=$2
  ORDERER_ADDRESS=$3
  ORDERER_TLS_CA=$4
  CHAINCODE_NAME="mycc"
  setPeerGlobals $PEER

  set -x
  peer chaincode invoke -o ${ORDERER_ADDRESS} --tls --cafile $ORDERER_TLS_CA --clientauth --certfile $ADMIN_TLS_CERTFILE --keyfile $ADMIN_TLS_KEYFILE -C $CHANNEL_NAME -n ${CHAINCODE_NAME} -c '{"Args":["invoke","a","b","10"]}' &> $LOG_FILE
  res=$?
  set +x
  verifyResult $res "Invoke execution on $PEER failed "
  cat $LOG_FILE
  echo
  echo "===================== Invoke transaction successful on 'peer$PEER' of org '${HLF_ORG_NAME}' on channel '$CHANNEL_NAME' ===================== "
  echo
}

chaincodeQuery() {
  TIMEOUT=10
  PEER=$1
  CHANNEL_NAME=$2
  setPeerGlobals $PEER
  #EXPECTED_RESULT=$3
  echo "===================== Querying on 'peer${PEER}' of org '${HLF_ORG_NAME}' on channel '$CHANNEL_NAME'... ===================== "
  local rc=1

  local starttime=$(date +%s)
  # continue to poll
  # we either get a successful response, or reach TIMEOUT
  while
    test "$(($(date +%s) - starttime))" -lt "$TIMEOUT"
  do
    #echo "Attempting to Query peer${PEER} of ${HLF_ORG_NAME} ...$(($(date +%s) - starttime)) secs"
    set -x
    peer chaincode query -C $CHANNEL_NAME -n mycc -c '{"Args":["query","a"]}' >&$LOG_FILE
    res=$?
    set +x
    if [ $res -eq 0 ]; then
      rc=0
      break;
    fi
    sleep $DELAY
  done
  echo
  if test $rc -eq 0; then
    echo "===================== Query successful on 'peer${PEER}' of '${HLF_ORG_NAME}' org on channel '$CHANNEL_NAME' ===================== "
    VALUE=$(cat $LOG_FILE | egrep '^[0-9]+$')
    echo
    echo "========= RESULT: ${VALUE} =========="
    echo
  else
    verifyResult $res "Query result on 'peer${PEER}' of '${HLF_ORG_NAME}' org is INVALID"
  fi
}

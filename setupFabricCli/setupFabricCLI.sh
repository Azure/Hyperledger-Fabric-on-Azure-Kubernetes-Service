#!/bin/bash

createOrgMSP() {
    orgName=$1
    adminProfilePath=$2
    connectionProfilePath=$3
    mspProfilePath=$4
    nodeName=$5

    rm -rf ./${nodeType}/${orgName}/*
    mkdir -p ./${nodeType}/${orgName}/msp/{admincerts,cacerts,keystore,signcerts,tlscacerts}
    mkdir -p ./${nodeType}/${orgName}/tls
    
    #admincerts
    cat ${adminProfilePath} | jq '.cert' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/admincerts/cert.pem

    #cacerts
    cat ${mspProfilePath} | jq '.cacerts' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/cacerts/rca.pem

    #tlscacerts
    cat ${connectionProfilePath} | jq '.'$nodeType's."'$nodeName'.'${orgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > ./${nodeType}/${orgName}/msp/tlscacerts/ca.crt

    #signcerts
    cp ./${nodeType}/${orgName}/msp/admincerts/cert.pem ./${nodeType}/${orgName}/msp/signcerts/cert.pem

    #keystore
    cat ${adminProfilePath} | jq '.private_key' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/msp/keystore/key.pem

    #admin-tls-cert
    cat ${adminProfilePath} | jq '.tls_cert' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/tls/cert.pem

    #admin-tls-key
    cat ${adminProfilePath} | jq '.tls_private_key' | tr -d '"' | base64 -d > ./${nodeType}/${orgName}/tls/key.pem
}

createOrdererTLSCA() {
    rm -rf ./orderer/${ordererOrgName}/*
    mkdir -p ./orderer/${ordererOrgName}/msp/tlscacerts

    #tlscacerts
    cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > ./orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
}

setEnvVars() {
    orgName=$1
    connectionProfilePath=$2
    nodeName=$3

    export CORE_PEER_LOCALMSPID="${orgName}"
    export CORE_PEER_ADDRESS=$(cat ${connectionProfilePath} | jq '.'$nodeType's."'$nodeName'.'${orgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
    export CORE_PEER_TLS_ENABLED="true"
    export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/${nodeType}/${orgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_TLS_CLIENTAUTHREQUIRED="true"
    export CORE_PEER_TLS_CLIENTCERT_FILE=$(pwd)/${nodeType}/${orgName}/tls/cert.pem
    export CORE_PEER_TLS_CLIENTKEY_FILE=$(pwd)/${nodeType}/${orgName}/tls/key.pem
    export CORE_PEER_TLS_CLIENTROOTCAS_FILES=$(pwd)/${nodeType}/${orgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$(pwd)/${nodeType}/${orgName}/msp

    if [ "${nodeType}" = "peer" ]; then
        ordererConnectionProfilePath=$4
        ordererNodeName=$5
        export ORDERER_ENDPOINT=$(cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
        export ORDERER_TLS_CERT=$(pwd)/orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
    fi 
}

nodeType=$1
if [ "${nodeType}" = "peer" ]; then
    if [ $# -ne 7 ]; then
        echo "======= Please provide the following arguments correctly (in order): ======="
        echo -e "\tPeer Admin Profile Path"
        echo -e "\t\t- You must download it from Azure Portal UI of your member overview pane."
        echo -e "\tPeer Connection Profile Path"
        echo -e "\t\t- You must download it from Azure Portal UI of your member overview pane."
        echo -e "\tPeer MSP JSON Profile Path"
        echo -e "\t\t- You may use \"azhlf\" tool to fetch the MSP profile JSON using the following command:"
        echo -e "\t\t- ./azhlf msp import fromAzure -g \$PEER_ORG_RESOURCE_GROUP -s \$PEER_ORG_SUBSCRIPTION -o \$PEER_ORG_NAME"
        echo -e "\tPeer node name: e.g. \"peer<peer#>\""
        echo -e "\tOrderer Connection Profile Path"
        echo -e "\t\t- You must download it from Azure Portal UI of your member overview pane."
        echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
    else
        peerAdminProfilePath=$2
        peerConnectionProfilePath=$3
        peerMSPProfilePath=$4
        peerNodeName=$5
        ordererConnectionProfilePath=$6
        ordererNodeName=$7

        peerOrgName=$(cat ${peerAdminProfilePath} | jq '.msp_id' | tr -d '"')
        ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

        createOrgMSP $peerOrgName $peerAdminProfilePath $peerConnectionProfilePath $peerMSPProfilePath $peerNodeName
        createOrdererTLSCA
        setEnvVars $peerOrgName $peerConnectionProfilePath $peerNodeName $ordererConnectionProfilePath $ordererNodeName
    fi
else
    if [ $# -ne 5 ]; then
        echo "======= Please provide the following arguments correctly (in order): ======="
        echo -e "\tOrderer Admin Profile Path"
        echo -e "\t\t- You must download it from Azure Portal UI of your member overview pane."
        echo -e "\tOrderer Connection Profile Path"
        echo -e "\t\t- You must download it from Azure Portal UI of your member overview pane."
        echo -e "\tOrderer MSP JSON Profile Path"
        echo -e "\t\t- You may use \"azhlf\" tool to fetch the MSP profile JSON using the following command:"
        echo -e "\t\t- ./azhlf msp import fromAzure -g \$ORDERER_ORG_RESOURCE_GROUP -s \$ORDERER_ORG_SUBSCRIPTION -o \$ORDERER_ORG_NAME"
        echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
    else
        ordererAdminProfilePath=$2
        ordererConnectionProfilePath=$3
        ordererMSPProfilePath=$4
        ordererNodeName=$5

        ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

        createOrgMSP $ordererOrgName $ordererAdminProfilePath $ordererConnectionProfilePath $ordererMSPProfilePath $ordererNodeName
        setEnvVars $ordererOrgName $ordererConnectionProfilePath $ordererNodeName
    fi
fi
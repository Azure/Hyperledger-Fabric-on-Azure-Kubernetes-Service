#!/bin/bash

createPeerMSP() {
    rm -rf ./peer/${peerOrgName}/*
    mkdir -p ./peer/${peerOrgName}/msp/{admincerts,cacerts,keystore,signcerts,tlscacerts}
    mkdir -p ./peer/${peerOrgName}/tls
    
    #admincerts
    cat ${peerAdminProfilePath} | jq '.cert' | tr -d '"' | base64 -d > ./peer/${peerOrgName}/msp/admincerts/cert.pem

    #cacerts
    cat ${peerMSPProfilePath} | jq '.cacerts' | tr -d '"' | base64 -d > ./peer/${peerOrgName}/msp/cacerts/rca.pem

    #tlscacerts
    cat ${peerConnectionProfilePath} | jq '.peers."'$peerNodeName'.'${peerOrgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > ./peer/${peerOrgName}/msp/tlscacerts/ca.crt

    #signcerts
    cp ./peer/${peerOrgName}/msp/admincerts/cert.pem ./peer/${peerOrgName}/msp/signcerts/cert.pem

    #keystore
    cat ${peerAdminProfilePath} | jq '.private_key' | tr -d '"' | base64 -d > ./peer/${peerOrgName}/msp/keystore/key.pem

    #admin-tls-cert
    cat ${peerAdminProfilePath} | jq '.tls_cert' | tr -d '"' | base64 -d > ./peer/${peerOrgName}/tls/cert.pem

    #admin-tls-key
    cat ${peerAdminProfilePath} | jq '.tls_private_key' | tr -d '"' | base64 -d > ./peer/${peerOrgName}/tls/key.pem
}

createOrdererMSP() {
    rm -rf ./orderer/${ordererOrgName}/*
    mkdir -p ./orderer/${ordererOrgName}/msp/tlscacerts

    #tlscacerts
    cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > ./orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
}

setEnvVars() {
    export CORE_PEER_LOCALMSPID="${peerOrgName}"
    export CORE_PEER_ADDRESS=$(cat ${peerConnectionProfilePath} | jq '.peers."'$peerNodeName'.'${peerOrgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
    export CORE_PEER_TLS_ENABLED="true"
    export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/peer/${peerOrgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_TLS_CLIENTAUTHREQUIRED="true"
    export CORE_PEER_TLS_CLIENTCERT_FILE=$(pwd)/peer/${peerOrgName}/tls/cert.pem
    export CORE_PEER_TLS_CLIENTKEY_FILE=$(pwd)/peer/${peerOrgName}/tls/key.pem
    export CORE_PEER_TLS_CLIENTROOTCAS_FILES=$(pwd)/peer/${peerOrgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$(pwd)/peer/${peerOrgName}/msp

    export ORDERER_ENDPOINT=$(cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
    export ORDERER_TLS_CERT=$(pwd)/orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
}

if [ $# -ne 6 ]; then
    echo "Please provide the following arguments correctly:"
    echo -e "\tPeer Admin Profile Path"
    echo -e "\tPeer Connection Profile Path"
    echo -e "\tPeer MSP JSON Profile Path"
    echo -e "\tPeer node name: e.g. \"peer<peer#>\""
    echo -e "\tOrderer Connection Profile Path"
    echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
else
    peerAdminProfilePath=$1
    peerConnectionProfilePath=$2
    peerMSPProfilePath=$3
    peerNodeName=$4
    ordererConnectionProfilePath=$5
    ordererNodeName=$6

    peerOrgName=$(cat ${peerAdminProfilePath} | jq '.msp_id' | tr -d '"')
    ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

    createPeerMSP
    createOrdererMSP
    setEnvVars
fi
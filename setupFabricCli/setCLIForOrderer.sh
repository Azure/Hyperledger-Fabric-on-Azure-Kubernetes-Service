#!/bin/bash

createOrdererMSP() {
    rm -rf ./orderer/${ordererOrgName}/*
    mkdir -p ./orderer/${ordererOrgName}/msp/{admincerts,cacerts,keystore,signcerts,tlscacerts}
    mkdir -p ./orderer/${ordererOrgName}/tls
    
    #admincerts
    cat ${ordererAdminProfilePath} | jq '.cert' | tr -d '"' | base64 -d > ./orderer/${ordererOrgName}/msp/admincerts/cert.pem

    #cacerts
    cat ${ordererMSPProfilePath} | jq '.cacerts' | tr -d '"' | base64 -d > ./orderer/${ordererOrgName}/msp/cacerts/rca.pem

    #tlscacerts
    cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".tlsCACerts.pem' | tr -d '"' | sed 's/\\n/\n/g' > ./orderer/${ordererOrgName}/msp/tlscacerts/ca.crt

    #signcerts
    cp ./orderer/${ordererOrgName}/msp/admincerts/cert.pem ./orderer/${ordererOrgName}/msp/signcerts/cert.pem

    #keystore
    cat ${ordererAdminProfilePath} | jq '.private_key' | tr -d '"' | base64 -d > ./orderer/${ordererOrgName}/msp/keystore/key.pem

    #admin-tls-cert
    cat ${ordererAdminProfilePath} | jq '.tls_cert' | tr -d '"' | base64 -d > ./orderer/${ordererOrgName}/tls/cert.pem

    #admin-tls-key
    cat ${ordererAdminProfilePath} | jq '.tls_private_key' | tr -d '"' | base64 -d > ./orderer/${ordererOrgName}/tls/key.pem
}

setEnvVars() {
    export CORE_PEER_LOCALMSPID="${ordererOrgName}"
    export CORE_PEER_ADDRESS=$(cat ${ordererConnectionProfilePath} | jq '.orderers."'$ordererNodeName'.'${ordererOrgName}'".url' | sed 's/grpcs:\/\///g' | tr -d '"')
    export CORE_PEER_TLS_ENABLED="true"
    export CORE_PEER_TLS_ROOTCERT_FILE=$(pwd)/orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_TLS_CLIENTAUTHREQUIRED="true"
    export CORE_PEER_TLS_CLIENTCERT_FILE=$(pwd)/orderer/${ordererOrgName}/tls/cert.pem
    export CORE_PEER_TLS_CLIENTKEY_FILE=$(pwd)/orderer/${ordererOrgName}/tls/key.pem
    export CORE_PEER_TLS_CLIENTROOTCAS_FILES=$(pwd)/orderer/${ordererOrgName}/msp/tlscacerts/ca.crt
    export CORE_PEER_MSPCONFIGPATH=$(pwd)/orderer/${ordererOrgName}/msp
}


if [ $# -ne 4 ]; then
    echo "Please provide the following arguments correctly:"
    echo -e "\tOrderer Admin Profile Path"
    echo -e "\tOrderer Connection Profile Path"
    echo -e "\tOrderer MSP JSON Profile Path"
    echo -e "\tOrderer node name: e.g. \"orderer<orderer#>\""
else
    ordererAdminProfilePath=$1
    ordererConnectionProfilePath=$2
    ordererMSPProfilePath=$3
    ordererNodeName=$4

    ordererOrgName=$(cat ${ordererConnectionProfilePath} | jq '.name' | tr -d '"')

    createOrdererMSP
    setEnvVars
fi
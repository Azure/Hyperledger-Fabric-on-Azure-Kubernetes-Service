#!/bin/bash

printCommandHelp() {
    echo "Command Help:"
    echo -e "source patchPeerDeployment.sh <peerSubscriptionID> <peerResourceGroup> <peerAKSClusterName>"
    echo
    echo "Arguments:"
    echo -e "\tpeerSubscriptionID    : Subscription ID of AKS-HLF peer template deployment"
    echo -e "\tpeerResourceGroup     : Resource group of AKS-HLF peer template deployment"
    echo -e "\tpeerAKSClusterName    : AKS Cluster name of AKS-HLF peer template deployment"
}

PEER_ORG_SUBSCRIPTION=$1
PEER_ORG_RESOURCE_GROUP=$2
PEER_ORG_AKS_NAME=$3

if [ -z $PEER_ORG_SUBSCRIPTION ] || [ -z $PEER_ORG_RESOURCE_GROUP ] || [ -z $PEER_ORG_AKS_NAME ]; then
    echo
    echo "Peer organization subscription, resource group and AKS cluster name cannot be empty!"
    echo

    printCommandHelp

    return;
fi

if ! command -v az &> /dev/null; then
    echo
    echo "Command \"az\" not found! Please download Azure CLI for your system."
    echo "To setup Azure CLI after installation, run: az login with valid credentials!"
    echo

    return;
fi

az aks get-credentials --resource-group $PEER_ORG_RESOURCE_GROUP \
                       --name $PEER_ORG_AKS_NAME \
                       --subscription $PEER_ORG_SUBSCRIPTION
res=$?
if [ $res -ne 0 ]; then
    echo
    echo "Switching to AKS cluster config failed with error code: $res!"
    echo

    printCommandHelp
    
    return
fi

ns=hlf
deployments="$(kubectl get deploy -n $ns -o=jsonpath='{.items[*].metadata.name}')"

for deployment in $deployments; do
    resource=deploy/$deployment

    if [[ $deployment == peer* ]]; then
        echo "Updating" $deployment

        kubectl scale -n $ns $resource --replicas=0
        kubectl rollout status -n $ns $resource -w

        kubectl patch deployment $deployment -n $ns -p \
        '{"spec": { "template": { "spec": { "containers": [ { "name":"'$deployment'", "env": [{ "name": "CORE_CHAINCODE_BUILDER", "value": "hlfakstemplateoss.azurecr.io/hyperledger/fabric-ccenv:1.4.4" }, { "name": "CORE_CHAINCODE_GOLANG_RUNTIME", "value": "hlfakstemplateoss.azurecr.io/hyperledger/fabric-baseos:amd64-0.4.18" }, { "name": "CORE_CHAINCODE_NODE_RUNTIME", "value": "hlfakstemplateoss.azurecr.io/hyperledger/fabric-baseimage:amd64-0.4.18" }, { "name": "CORE_CHAINCODE_JAVA_RUNTIME", "value": "" }, { "name": "CORE_CHAINCODE_CAR_RUNTIME", "value": "" }] } ] } } } }'

        kubectl scale -n $ns $resource --replicas=1
        kubectl rollout status -n $ns $resource -w
    fi
done
#!/bin/bash
function printUsage() {
    echo "Usage:"
    echo -e "./AksHlfTroubleshooting.sh <subscriptionID> <resourceGroup> <aksClusterName> <organizationType>"
    echo "Arguments:"
    echo -e "\tsubscriptionID    : Subscription ID of AKS-HLF template deployment"
    echo -e "\tresourceGroup     : Resource group of AKS-HLF template deployment"
    echo -e "\taksClusterName    : AKS Cluster name"
    echo -e "\torganizationType  : Specify \"peer\" for peer organization and \"orderer\" for orderer organization"
}

function collectHlfNodesLogs() {
    echo "Start collecting hlf nodes logs..."
    {
        echo "================= HLF NODES LOGS ================"
        kubectl get all -n hlf
    
        for (( i=1; i<=$nodeCount; i++ ))
        do
            echo "------- Start: $organizationType$i node description -------------"
            kubectl describe pod --selector="name=$organizationType$i" -n hlf

            echo "------- End: $organizationType$i node description -------------"
    
	    containers=($(kubectl get pods -l "name=$organizationType$i" -n hlf -o jsonpath={.items[*].spec.containers[*].name}))
	    podName=$(kubectl get pods -l "name=$organizationType$i" -ojsonpath={.items[0].metadata.name} -n hlf)
	    for container in "${containers[@]}"; do
              echo "------- Start: $organizationType$i node $container container logs -------------"
              kubectl logs $podName -n hlf -c $container
              echo "------- End: $organizationType$i node $container container logs -------------"
	    done
        done
    } > $outputPath/nodes.output
    echo "End collecting hlf nodes logs..."
}

function collectNginxLogs() {
    {
        echo "================= NGINX LOGS ================"
        kubectl get all -n nginx
        echo "------- Start: nginx controller logs -------------"
        kubectl logs $(kubectl get pods -l "app=nginx-ingress" -ojsonpath={.items[0].metadata.name} -n nginx) -n nginx
        echo "------- End: nginx controller logs -------------"
    } > $outputPath/nginx.output
}

function collectIngressLogs() {
    echo "Start Collecting ingress logs..."
    {
        echo "================= INGRESS LOGS ================"
        echo "------- Start: ingress logs -------------"
        kubectl get ingress --all-namespaces -o json
        echo "------- End: ingress logs -------------"
    } > $outputPath/ingress.output

    echo "End Collecting ingress logs..."
}

if [ $# -ne 4 ]; then
    echo "Invalid arguments count!!"
    printUsage
    exit 1
fi

subscriptionID=$1
resourceGroup=$2
aksClusterName=$3
organizationType=$4

which az
if [ "$?" -ne 0 ]; then
  echo "azure cli not found!!"
  echo "azure cli is mandatory for this script."
  echo "Please install azure cli and login with valid credentials"
  exit 1
fi

az aks get-credentials -g $resourceGroup -n $aksClusterName --subscription $subscriptionID
res=$?
if [ $res -ne 0 ]; then
    echo "Fetching AKS cluster credential failed with error code $res!!"
    printUsage
    exit 1
fi
echo "Connected to the AKS cluster..."

nodeCount=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.nodeCount})
orgName=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.orgName})
domainName=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.domainName})
outputPath="./output"
zipFileName="AksHlfTroubleshooting-$(date "+%Y-%m-%d-%T").zip"
rm -rf $outputPath
mkdir -p $outputPath

{
    echo "================= ORG METADATA ================"
    echo "Organization Name: $orgName, HLF node count: $nodeCount, Domain name: $domainName"
} > $outputPath/metadata.output

collectHlfNodesLogs
collectNginxLogs
collectIngressLogs

zip -r $zipFileName output/
echo "Logs are stored at path: $(pwd)/$zipFileName"

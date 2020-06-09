#!/bin/bash
if [ $# -ne 4 ]; then
    echo "Invalid arguments passed to the script!!"
    echo "Please execute script with the followinf arguments:"
    echo "./AksHlfTroubleshooting.sh <subscriptioID> <resourceGroup> <aksClusterName> <organizationType>"
    exit 1
fi
subscriptionID=$1
resourceGroup=$2
aksClusterName=$3
organizationType=$4

az aks get-credentials -g $resourceGroup -n $aksClusterName --subscription $subscriptionID
echo "Connected to the cluster..."

nodeCount=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.nodeCount})
orgName=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.nodeCount})
domainName=$(kubectl get configmap -n hlf-admin org-detail -o jsonpath={.data.nodeCount})
outputPath="./output"
zipFileName="AksHlfTroubleshooting-$(date "+%Y-%m-%d-%T").zip"
rm -rf $outputPath
mkdir -p $outputPath

{
    echo "================= ORG METADATA ================"
    echo "Organization Name: $orgName, HLF node count: $nodeCount, Domain name: $domainName"
} > $outputPath/metadata.output
echo "Collected organization metadata..."

{
    echo "================= HLF NODES LOGS ================"
    kubectl get all -n hlf

    for (( i=1; i<=$nodeCount; i++ ))
    do
        echo "------- Start: $organizationType$i node description -------------"
        kubectl describe pod --selector="name=peer$i" -n hlf 
        echo "------- End: $organizationType$i node description -------------"

        echo "------- Start: $organizationType$i node logs -------------"
        if [ $organizationType = "peer" ]; then
            kubectl logs $(kubectl get pods -l "name=peer$i" -ojsonpath={.items[0].metadata.name} -n hlf) -n hlf -c peer$i
            kubectl logs $(kubectl get pods -l "name=peer$i" -ojsonpath={.items[0].metadata.name} -n hlf) -n hlf -c couchdb$i
        else
            kubectl logs $(kubectl get pods -l "name=orderer$i" -ojsonpath={.items[0].metadata.name} -n hlf) -n hlf
        fi
        echo "------- End: $organizationType$i node logs -------------"
    done
} > $outputPath/nodes.output
echo "Collected hlf nodes logs..."

{
    echo "================= NGINX LOGS ================"
    kubectl get all -n nginx
    echo "------- Start: nginx controller logs -------------"
    kubectl logs $(kubectl get pods -l "app=nginx-ingress" -ojsonpath={.items[0].metadata.name} -n nginx) -n nginx 
    echo "------- End: nginx controller logs -------------"
} > $outputPath/nginx.output
echo "Collected nginx logs..."

{
    echo "================= INGRESS LOGS ================"
    echo "------- Start: ingress logs -------------"
    kubectl get ingress --all-namespaces -o json
    echo "------- End: ingress logs -------------"
} > $outputPath/ingress.output
echo "Collected ingress logs..."

zip -r $zipFileName output/
echo "Logs are stored at path: $(pwd)/$zipFileName"

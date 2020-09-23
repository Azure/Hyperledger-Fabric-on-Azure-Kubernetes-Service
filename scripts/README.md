# Steps to patch peer nodes to fix chaincode tag issue
Please download the peer deployment script using the command:
`curl https://raw.githubusercontent.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/master/scripts/patchPeerDeployment.sh -o patchPeerDeployment.sh; chmod 777 patchPeerDeployment.sh`

Set the following peer deployment related variables before executing the script:
```
PEER_ORG_RESOURCE_GROUP="<peerOrgResourceGroupName>"
PEER_AKS_NAME="<peerOrgAKSClusterName>"
PEER_ORG_SUBSCRIPTION="<peerOrgSubscriptionId>"
```

Execute the script with following command:
`source patchPeerDeployment.sh $PEER_ORG_SUBSCRIPTION $PEER_ORG_RESOURCE_GROUP $PEER_AKS_NAME`

Please wait for all your peer nodes to get patched. You can always check the status of your peer nodes, in different instance of the shell using the command:
`kubectl get pods -n hlf`

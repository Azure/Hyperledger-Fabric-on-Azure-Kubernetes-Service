# This script clones 'azhlfTool' folder from
# Azure github repo
echo
echo "===> Cloning azhlf Tool ..."
echo
git init
git config core.sparsecheckout true
echo "azhlfTool" > .git/info/sparse-checkout
git remote add -f origin https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service.git
git reset --hard origin/azhlfTool1.4.4-absca
git pull origin azhlfTool1.4.4-absca
echo
echo "===> Done"
echo

# This script clones 'azhlfTool' folder from
# Azure github repo
echo
echo "===> Cloning azhlf Tool ..."
echo
git init
git config core.sparsecheckout true
echo "azhlfTool" > .git/info/sparse-checkout
git remote add -f origin https://github.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service.git
git reset --hard origin/master
git pull origin master
echo
echo "===> Done"
echo

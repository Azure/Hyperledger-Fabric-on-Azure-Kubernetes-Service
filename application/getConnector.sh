#!/bin/bash
#read -p "Input resource group, please: " resourceGroup
resourceGroup=$1

subscriptionId=$(az account show --query id -o tsv)
webAppRes=$(az resource list --resource-group $resourceGroup --resource-type "Microsoft.Web/sites" | grep "name")
webApp="${webAppRes//[\":,[:blank:]]}"
webAppName="${webApp//name}"
resourceId="/subscriptions/$subscriptionId/resourceGroups/$resourceGroup/providers/Microsoft.Web/sites/$webAppName"

accessToken=$(az account get-access-token --query accessToken -o tsv)
functionName="ConfigManager"
listFunctionKeysUrl="https://management.azure.com$resourceId/functions/$functionName/listKeys?api-version=2018-02-01"

functionRes=$(curl -s -X POST $listFunctionKeysUrl -H "Content-Type: application/json" -H "Authorization: Bearer $accessToken" -H 'Content-Length: 0')
function="${functionRes//[\{\}\":]}"
functionDefaultKey="${function//default}"

echo -e "\nhttps://$webAppName.azurewebsites.net/api/{action}?code=$functionDefaultKey\n"

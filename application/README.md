# Run native HLF operations
To help customers get started with executing Hyperledger native commands on HLF network on AKS. The sample application is provided that uses fabric NodeJS SDK to perform the HLF operations. The commands are provided to Create new user identity and install your own chaincode.

### Before you begin
Follow the below commands for the initial setup of the application:

   - [ Download application files](#downloadFiles)
   - [ Generate connection profile and admin profile](#profileGen)
   - [Import admin user identity](#importAdmin)
   
After completing the initial setup, you can use the SDK to achieve the below operations:
-  [User identity generation](#fabricca)
-  [Chaincode operations](#chaincode)

The above-mentioned commands can be executed from Azure Cloud Shell.

<a name="downloadFiles"></a>
### Download application files
The first setup for running application is to download all the application files in a folder say ```app```. 

Create ```app``` folder and enter into the folder:
```bash
mkdir app
cd app
```

Execute below command to download all the required files and packages:
```bash
curl https://raw.githubusercontent.com/Azure/Hyperledger-Fabric-on-Azure-Kubernetes-Service/master/application/setup.sh | bash
```

This command takes some time as it loads all the packages. After successful execution of the command, you can see a ```node_modules``` folder in the current directory. All the required packages are loaded in the ```node_modules``` folder.

<a name="profileGen"></a>
### Generate connection profile and admin profile
Create ```profile``` directory inside the ```app``` folder
```bash
cd app
mkdir ./profile
```

Set these environment variables on Azure cloud shell
```bash
# Organization name whose connection profile is to be generated
ORGNAME=<orgname>
# Organization AKS cluster resource group
AKS_RESOURCE_GROUP=<resourceGroup>
```

Execute below comand to generate connection profile and admin profile of the organization
```bash
./getConnector.sh $AKS_RESOURCE_GROUP | sed -e "s/{action}/gateway/g"| xargs curl > ./profile/$ORGNAME-ccp.json
./getConnector.sh $AKS_RESOURCE_GROUP | sed -e "s/{action}/admin/g"| xargs curl > ./profile/$ORGNAME-admin.json
```
It will create connection profile and admin profile of the organization inside the ```profile``` folder with name ```<orgname>-ccp.json``` and ```<orgname>-admin.json``` respectively. 

Similarly, generate connection profile and admin profile for each orderer and peer organization.

<a name="importAdmin"></a>
### Import admin user identity
The last step is to import organization's admin user identity in the wallet.

```
npm run importAdmin -- -o <orgName>
```
The above command executes importAdmin.js to import the admin user identity into the wallet. The script reads admin identity from the admin profile ```<orgname>-admin.json``` and imports it in wallet for executing HLF operations.

The scripts use file system wallet to store the identites. It creates a wallet as per the path specified in ".wallet" field in the connection profile. By default, ".wallet" field is initalized with ```<orgname>```, which means a folder named ```<orgname>``` is created in the current directory to store the identities. If you want to create wallet at some other path, modify ".wallet" field in the connection profile before running enroll admin user and any other HLF operations.

Similarly, import admin user identity for each organization.

Refer command help for more details on the arguments passed in the command
```
npm run importAdmin -- -h
```

<a name="fabricca"></a>
### User identity generation
Execute below commands in the given order to generate new user identites for the HLF organization. 

> **_Note:_** Before starting with user identity generation steps, ensure that the initial setup of the application is done.

#### Set below enviroment variables on azure cloud shell
```
# Organization name for which user identity is to be generated
ORGNAME=<orgname>
# Name of new user identity. Identity will be registered with the Fabric-CA using this name.
USER_IDENTITY=<username>
```
#### Register and enroll new user
To register and enroll new user, execute the below command that executes registerUser.js. It saves the generated user identity in the wallet.
```bash
npm run registerUser -- -o $ORGNAME -u $USER_IDENTITY
```
> **_Note:_** Admin user identity is used to issue register command for the new user. Hence, it is mandatory to have the admin user identity in the wallet before executing this command. Otherwise, this command will fail.

Refer command help for more details on the arguments passed in the command
```bash
npm run registerUser -- -h
```
<a name="chaincode"></a>
### Chaincode operations
> **_Note:_** Before starting with user identity generation steps, ensure that the initial setup of the application is done.

<a name="envCC"></a>
#### Set below chaincode specific environment variables on Azure Cloud shell:
```
# peer organization name where chaincode is to be installed
ORGNAME=<orgName>
USER_IDENTITY="admin.$ORGNAME"
CC_NAME=<chaincodeName>
CC_VERSION=<chaincodeVersion>
# Language in which chaincode is written. Supported languages are 'node', 'golang' and 'java'
# Default value is 'golang'
CC_LANG=<chaincodeLanguage>
# CC_PATH contains the path where your chaincode is place. In case of go chaincode, this path is relative to 'GOPATH'.
# For example, if your chaincode is present at path '/opt/gopath/src/chaincode/chaincode.go'.
# Then, set GOPATH to '/opt/gopath' and CC_PATH to 'chaincode'
CC_PATH=<chaincodePath>
# 'GOPATH' environment variable. This needs to be set in case of go chaincode only.
export GOPATH=<goPath>
# Channel on which chaincode is to be instantiated/invoked/queried
CHANNEL=<channelName>
```
The below chaincode operations can be carried out
- [Install chaincode](#installCC)
- [Instantiate chaincode](#instantiateCC)
- [Invoke chaincode](#invokeCC)
- [Query chaincode](#queryCC)

<a name="installCC"></a>
#### Install chaincode
Execute below command to install chaincode on the peer organization. 
```
npm run installCC -- -o $ORGNAME -u $USER_IDENTITY -n $CC_NAME -p $CC_PATH -l $CC_LANG -v $CC_VERSION
```

It will install chaincode on all the peer nodes of the organization set in ```ORGNAME``` environment variable. If there are two or more peer organizations in your channel and you want to install chaincode on all of them, then this command needs to be executed separately for each peer organization. \

Follow the steps:
- Set ```ORGNAME``` to ```<peerOrg1Name>``` and issue ```installCC``` command. 
- Set ```ORGNAME``` to ```<peerOrg2Name>``` and issue ```installCC``` command. 

Execute it for each peer organization.

Refer command help for more details on the arguments passed in the command
```
npm run installCC -- -h
```
<a name="instantiateCC"></a>
#### Instantiate chaincode
Execute below command to instantiate chaincode on the peer. 
```
npm run instantiateCC -- -o $ORGNAME -u $USER_IDENTITY -n $CC_NAME -p $CC_PATH -v $CC_VERSION -l $CC_LANG -c $CHANNEL -f <instantiateFunc> -a <instantiateFuncArgs>
```
Pass instantiation function name and comma seperated list of arguments in ```<instantiateFunc>``` and  ```<instantiateFuncArgs>``` respectively. For example, in [ fabrcar chaincode](https://github.com/hyperledger/fabric-samples/blob/release/chaincode/fabcar/fabcar.go), to instantiate the chaincode set ```<instantiateFunc>``` to ```"Init"``` and ```<instantiateFuncArgs>``` to empty string ```""```.

> **_Note:_** Execute the command once from any one peer organization in the channel. Once the transaction is successfully submitted to the orderer, the orderer distributes this transaction to all the peer organizations in the channel. Hence, the chaincode is instantiated on all the peer nodes on all the peer organizations in the channel.

Refer command help for more details on the arguments passed in the command
```
npm run instantiateCC -- -h
```

<a name="invokeCC"></a>
#### Invoke chaincode
Execute below command to invoke the chaincode function:
```
npm run invokeCC -- -o $ORGNAME -u $USER_IDENTITY -n $CC_NAME -c $CHANNEL -f <invokeFunc> -a <invokeFuncArgs>
```
Pass invoke function name and comma seperated list of arguments in ```<invokeFunction>``` and  ```<invokeFuncArgs>``` respectively. Continuing with the ```fabcar``` chaincode example, to invoke ```initLedger``` function set ```<invokeFunction>``` to ```"initLedger"``` and ```<invokeFuncArgs>``` to ```""```.

> **_Note:_** Execute the command for once from any one peer organization in the channel. Once the transaction is successfully submitted to the orderer, the orderer distributes this transaction to all the peer organizations in the channel. Hence, the world state is updated on all peer nodes of all the peer organizations in the channel.

Refer command help for more details on the arguments passed in the command
```
npm run invokeCC -- -h
```
<a name="queryCC"></a>
#### Query chaincode
Execute below command to query chaincode:
```
npm run queryCC -- -o $ORGNAME -u $USER_IDENTITY -n $CC_NAME -c $CHANNEL -f <queryFunction> -a <queryFuncArgs>
```
Pass query function name and comma seperated list of arguments in ```<queryFunction>``` and  ```<queryFuncArgs>``` respectively. Again taking ```fabcar``` chaincode as reference, to query all the cars in the world state set ```<queryFunction>``` to ```"queryAllCars"``` and ```<queryArgs>``` to ```""```.

Refer command help for more details on the arguments passed in the command
```
npm run queryCC -- -h
```

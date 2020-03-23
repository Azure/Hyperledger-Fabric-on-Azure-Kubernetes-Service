#!/bin/bash

toolsNamespace="tools"
caNamespace="ca"
statusNamespace="metadata"
nodesNamespace="hlf"
adminNamespace="hlf-admin"
nginxNamespace="nginx"

CAServerName="ca.ca.svc.cluster.local."
CAOperationPort="9443"
CAServerPort="7054"

CA_ADMIN_USERNAME_FILE="/var/hyperledger/fabric-ca-credentials/ca-admin-user"
CA_ADMIN_PASSWORD_FILE="/var/hyperledger/fabric-ca-credentials/ca-admin-password"
CA_DB_TYPE_FILE="/var/hyperledger/fabric-ca-server-db/db-type"
CA_DB_DATASOURCE_FILE="/var/hyperledger/fabric-ca-server-db/datasource"

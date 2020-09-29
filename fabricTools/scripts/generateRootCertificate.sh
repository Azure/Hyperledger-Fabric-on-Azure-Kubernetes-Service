orgName=$1
domainName=$2
fabricToolsScriptStartTime=$3

. /var/hyperledger/scripts/globals.sh
. /var/hyperledger/scripts/utils.sh

rm -rf /tmp/rca
mkdir -p /tmp/rca

touch /tmp/rca/index.txt
mkdir -p /tmp/rca/newcerts

openssl ecparam -name prime256v1 -genkey -noout -out /tmp/rca/rca.key || exit 1

openssl req -config /var/hyperledger/scripts/openssl_root.cnf -new -sha256 -extensions v3_ca -key /tmp/rca/rca.key -out /tmp/rca/rca.csr -days 3650 -subj "/C=US/ST=Washington/L=Redmond/O=${orgName}/OU=${orgName}/CN=rca.${orgName}" || exit 1

openssl ca -create_serial -selfsign -days 3650 -notext -md sha256 -in /tmp/rca/rca.csr -out /tmp/rca/rca.pem -keyfile /tmp/rca/rca.key -startdate `date --date 'now - 10 minutes' +%Y%m%d%H%M%SZ` -config /var/hyperledger/scripts/openssl_root.cnf -extensions v3_ca || exit 1

# Store private certificates in secrets
CA_CERT=$(ls /tmp/rca/rca.key)
executeKubectlWithRetry "kubectl -n ${toolsNamespace} create secret generic hlf-ca-idkey --from-file=rca.key=$CA_CERT" "Storing Fabric-CA Root CA key in kubernetes secret failed" "$fabricToolsScriptStartTime" "no-verifyResult"
if [ $res -ne 0 ]; then
  logMessage "Error" "Storing Fabric-CA Root CA key in kubernetes secret failed" "$fabricToolsScriptStartTime"
  rm -rf /tmp/rca/*
  exit 1
fi

# Store public certificates in secrets
CA_CERT=$(ls /tmp/rca/rca.pem)
executeKubectlWithRetry "kubectl -n ${toolsNamespace} create secret generic hlf-ca-idcert --from-file=rca.pem=$CA_CERT" "Storing Fabric-CA Root CA certificate in kubernetes secret failed" "$fabricToolsScriptStartTime" "no-verifyResult"
if [ $res -ne 0 ]; then
  logMessage "Error" "Storing Fabric-CA Root CA certificate in kubernetes secret failed" "$fabricToolsScriptStartTime"
  rm -rf /tmp/rca/*
  exit 1
fi

# Copy CA Root Public certificate for TLS communication with Fabric-ca
mkdir -p /tmp/fabric-ca/tls-certfile
cp /tmp/rca/rca.pem /tmp/fabric-ca/tls-certfile/
rm -rf /tmp/rca/*
exit 0

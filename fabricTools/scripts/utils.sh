. /var/hyperledger/scripts/globals.sh

function printCapabilities() {
echo "
################################################################################
#
#   SECTION: Capabilities
#
#   - This section defines the capabilities of fabric network. This is a new
#   concept as of v1.1.0 and should not be utilized in mixed networks with
#   v1.0.x peers and orderers.  Capabilities define features which must be
#   present in a fabric binary for that binary to safely participate in the
#   fabric network.  For instance, if a new MSP type is added, newer binaries
#   might recognize and validate the signatures from this type, while older
#   binaries without this support would be unable to validate those
#   transactions.  This could lead to different versions of the fabric binaries
#   having different world states.  Instead, defining a capability for a channel
#   informs those binaries without this capability that they must cease
#   processing transactions until they have been upgraded.  For v1.0.x if any
#   capabilities are defined (including a map with all capabilities turned off)
#   then the v1.0.x peer will deliberately crash.
#
################################################################################
Capabilities:
    # Channel capabilities apply to both the orderers and the peers and must be
    # supported by both.
    # Set the value of the capability to true to require it.
    Channel: &ChannelCapabilities
        # V1.4.3 for Channel is a catchall flag for behavior which has been
        # determined to be desired for all orderers and peers running at the v1.3.x
        # level, but which would be incompatible with orderers and peers from
        # prior releases.
        # Prior to enabling V1.4.3 channel capabilities, ensure that all
        # orderers and peers on a channel are at v1.3.0 or later.
        V1_4_3: true
    # Orderer capabilities apply only to the orderers, and may be safely
    # used with prior release peers.
    # Set the value of the capability to true to require it.
    Orderer: &OrdererCapabilities
        # V1.4.2 for Orderer is a catchall flag for behavior which has been
        # determined to be desired for all orderers running at the v1.1.x
        # level, but which would be incompatible with orderers from prior releases.
        # Prior to enabling V1.4.2 orderer capabilities, ensure that all
        # orderers on a channel are at v1.4.2 or later.
        V1_4_2: true

    # Application capabilities apply only to the peer network, and may be safely
    # used with prior release orderers.
    # Set the value of the capability to true to require it.
    Application: &ApplicationCapabilities
        # V1.4.2 for Application enables the new non-backwards compatible
        # features and fixes of fabric v1.4.2.
        V1_4_2: true"
}

function printOrdererDefaults() {
echo "
################################################################################
#
#   SECTION: Orderer
#
#   - This section defines the values to encode into a config transaction or
#   genesis block for orderer related parameters
#
################################################################################
Orderer: &OrdererDefaults

    # Orderer Type: The orderer implementation to start
    # Available types are "solo" and "kafka"
    OrdererType: solo

    # Batch Timeout: The amount of time to wait before creating a batch
    BatchTimeout: 2s

    # Batch Size: Controls the number of messages batched into a block
    BatchSize:

        # Max Message Count: The maximum number of messages to permit in a batch
        MaxMessageCount: 10

        # Absolute Max Bytes: The absolute maximum number of bytes allowed for
        # the serialized messages in a batch.
        AbsoluteMaxBytes: 99 MB

        # Preferred Max Bytes: The preferred maximum number of bytes allowed for
        # the serialized messages in a batch. A message larger than the preferred
        # max bytes will result in a batch larger than preferred max bytes.
        PreferredMaxBytes: 512 KB

    Kafka:
        # Brokers: A list of Kafka brokers to which the orderer connects
        # NOTE: Use IP:port notation
        Brokers:
            - 127.0.0.1:9092

    # Organizations is the list of orgs which are defined as participants on
    # the orderer side of the network
    Organizations:

    # Policies defines the set of policies at this level of the config tree
    # For Orderer policies, their canonical path is
    #   /Channel/Orderer/<PolicyName>
    Policies:
        Readers:
            Type: ImplicitMeta
            Rule: \"ANY Readers\"
        Writers:
            Type: ImplicitMeta
            Rule: \"ANY Writers\"
        Admins:
            Type: ImplicitMeta
            Rule: \"MAJORITY Admins\"
        # BlockValidation specifies what signatures must be included in the block
        # from the orderer for the peer to validate it.
        BlockValidation:
            Type: ImplicitMeta
            Rule: \"ANY Writers\"
    "
}

function initOrgVars() {
    if [ $# -ne 1 ]; then
        echo "Usage: initOrgVars <ORG>"
        exit 1
    fi

    ORG=$1
    ORG_AKS_NAME=${ORG}Org
    ORG_MSP_ID=${ORG}
    ORG_MSP_DIR=${ORG_DIR}/msp
}

function printOrg {
   echo "
  - &$ORG_AKS_NAME

    Name: $ORG_MSP_ID

    # ID to load the MSP definition as
    ID: $ORG_MSP_ID

    # MSPDir is the filesystem path which contains the MSP configuration
    MSPDir: $ORG_MSP_DIR
    # Policies defines the set of policies at this level of the config tree
    # For organization policies, their canonical path is usually
    #   /Channel/<Application|Orderer>/<OrgName>/<PolicyName>
    Policies:
        Readers:
            Type: Signature
            Rule: \"OR('${ORG_MSP_ID}.member')\"
        Writers:
            Type: Signature
            Rule: \"OR('${ORG_MSP_ID}.member')\"
        Admins:
            Type: Signature
            Rule: \"OR('${ORG_MSP_ID}.admin')\" "
}

# printOrdererOrg <ORG>
function printOrdererOrg {
   printOrg
}

function printOrdererHost() {
    echo "               - orderer$1.$DOMAIN_NAME:443"
}

function printOrdererAdresses()
{
    for ((i=1;i<=$NODE_COUNT;i++));
    do
          printOrdererHost $i
    done
}

function printRaftConsenters() {
     for ((i=1;i<=$NODE_COUNT;i++));
     do
echo "
                - Host: orderer${i}
                  Port: 7050
                  ClientTLSCert: ${ORG_DIR}/orderers/orderer${i}/tls/server.crt
                  ServerTLSCert: ${ORG_DIR}/orderers/orderer${i}/tls/server.crt"
    done
}

function createConfigTxYaml() {
   ORG_NAME=$1
   DOMAIN_NAME=$2
   NODE_COUNT=$3
   ORG_DIR=$4

   initOrgVars $ORG_NAME
   {
   echo "
################################################################################
#
#   Section: Organizations
#
#   - This section defines the different organizational identities which will
#   be referenced later in the configuration.
#
################################################################################
Organizations:"

   printOrdererOrg $ORG_NAME
   
   printCapabilities

   echo "
################################################################################
#
#   SECTION: Application
#
#   This section defines the values to encode into a config transaction or
#   genesis block for application related parameters
#
################################################################################
Application: &ApplicationDefaults

    # Organizations is the list of orgs which are defined as participants on
    # the application side of the network
    Organizations:

    # Policies defines the set of policies at this level of the config tree
    # For Application policies, their canonical path is
    #   /Channel/Application/<PolicyName>
    Policies:
        Readers:
            Type: ImplicitMeta
            Rule: \"ANY Readers\"
        Writers:
            Type: ImplicitMeta
            Rule: \"ANY Writers\"
        Admins:
            Type: ImplicitMeta
            Rule: \"MAJORITY Admins\"

    Capabilities:
        <<: *ApplicationCapabilities
"
   printOrdererDefaults

   echo "
################################################################################
#
#   CHANNEL
#
#   This section defines the values to encode into a config transaction or
#   genesis block for channel related parameters.
#
################################################################################
Channel: &ChannelDefaults
    # Policies defines the set of policies at this level of the config tree
    # For Channel policies, their canonical path is
    #   /Channel/<PolicyName>
    Policies:
        # Who may invoke the 'Deliver' API
        Readers:
            Type: ImplicitMeta
            Rule: \"ANY Readers\"
        # Who may invoke the 'Broadcast' API
        Writers:
            Type: ImplicitMeta
            Rule: \"ANY Writers\"
        # By default, who may modify elements at this config level
        Admins:
            Type: ImplicitMeta
            Rule: \"MAJORITY Admins\"

    # Capabilities describes the channel level capabilities, see the
    # dedicated Capabilities section elsewhere in this file for a full
    # description
    Capabilities:
        <<: *ChannelCapabilities
    "

    echo "
################################################################################
#
#   Profile
#
#   - Different configuration profiles may be encoded here to be specified
#   as parameters to the configtxgen tool
#
################################################################################
Profiles:
  SampleEtcdRaftProfile:
    <<: *ChannelDefaults
    Capabilities:
        <<: *ChannelCapabilities
    Orderer:
        <<: *OrdererDefaults
        OrdererType: etcdraft
        Addresses:"
            printOrdererAdresses

    echo "
        Organizations:"
    echo "        - *${ORG_AKS_NAME}"
    echo "
        EtcdRaft:
            Consenters:"

           printRaftConsenters
echo "
        Capabilities:
            <<: *OrdererCapabilities
    Application:
        <<: *ApplicationDefaults
        Organizations:
            - <<: *${ORG_AKS_NAME}
    Consortiums:
      SampleConsortium:
        Organizations:
            - *${ORG_AKS_NAME}"
} > /tmp/configtx.yaml
}

function waitCAServerUp() {
    maxWaitTime=600  #wait maximum for 600s for CA server to come up
    startTime="$(date -u +%s)"
    scriptStartTime=$1
    while :
    do
        echo "[$(date -u)]: Check CA server health"
        # set max connection time to 30 seconds, to be sure curl does not stuck.
        healthResponse=$(curl --max-time 30 http://${CAServerName}:${CAOperationPort}/healthz)

        # if response is received, print it
        if [ -n "$healthResponse" ];
        then
            echo "${healthResponse}"
        fi

        currentTime="$(date -u +%s)"
        elapsedTime=$(($currentTime - $startTime))

        # check that status OK
        result=$(echo $healthResponse | grep '"status":"OK"')
        if [ -z "$result" ];
        then
            if [ $elapsedTime -ge $maxWaitTime ]; then
                verifyResult 1 "${CAServerName} server: max wait timeout. $elapsedTime seconds elapsed for CA server wait timeout to occur." $scriptStartTime
            else
                sleep 10
            fi
        else
            echo "${CAServerName} server came up. $elapsedTime seconds elapsed for ${CAServerName} server to come up."
            break
        fi
    done
}

function createNodeIngress() {
nodeType=$1
nodeCount=$2
domainName=$3

if [ "$nodeType" = "orderer" ]; then
    svcPort=7050
else
    svcPort=7051
fi

{
echo "
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ${nodeType}-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/backend-protocol: \"HTTPS\"
    nginx.ingress.kubernetes.io/ssl-passthrough: \"true\"
spec:
  rules:"

for ((i=1;i<=$nodeCount;i++));
do
echo "
  - host: ${nodeType}${i}.${domainName}
    http:
      paths:
      - backend:
          serviceName: ${nodeType}${i}
          servicePort: ${svcPort}"
done
} > /tmp/nodeIngress.yaml
}

function createCaIngress() {
domainName=$1

{
echo "
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: ca-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/backend-protocol: \"HTTPS\"
    nginx.ingress.kubernetes.io/ssl-passthrough: \"true\"
spec:
  rules:"
echo "
  - host: ca.${domainName}
    http:
      paths:
      - backend:
          serviceName: ca
          servicePort: 7054"
} > /tmp/caIngress.yaml
}

function exportSecret() {
secretName=$1
sourceNamespace=$2
targetNamespace=$3

kubectl -n ${sourceNamespace} get secret ${secretName} -o yaml | sed s/"namespace: ${sourceNamespace}"/"namespace: ${targetNamespace}"/ | kubectl apply -n ${targetNamespace} -f -
}

logMessage() {
  logCurrentTime="$(date -u +%s)"
  date=$(date -u)  
  scriptStartTime=$3
  logElapsedTime=$(($logCurrentTime - $scriptStartTime))	
  if [ "$1" = "Error" ]; then
    echo "==== [$date] HLF SETUP ERROR !!! "$2" !!! ERROR CODE: "$res" !!! Time elapsed: $logElapsedTime seconds ==============="
    echo
  elif [ "$1" = "Warning" ]; then
    echo "==== [$date] HLF SETUP WARNING !!! "$2" !!! Time elapsed: $logElapsedTime seconds ==============="                                                  
    echo
  elif [ "$1" = "Info" ]; then
    echo "=========== [$date] HLF SETUP INFO !!! $2 !!! Time elapsed: $logElapsedTime seconds ==========="
  fi
}

verifyResult() {
  if [ $1 -ne 0 ]; then
    logMessage "Error" "$2" $3  
    exit 1
  fi
}

executeKubectlWithRetry() {
  count=1
  maxRetries=3
  retryInterval=3
  startScriptTime=$3
  while [ $count -le $maxRetries ]
  do	  
    $1
    res=$?
    if [ $res -eq 0 ] 
    then
      break
    fi
    if [ $count -eq $maxRetries ];
    then
      verifyResult $res "Attempt $count: $2" $3	    
    fi
    logMessage "Warning" "Attempt $count: $2" $3
    sleep $retryInterval
    ((count++))
  done
}

updateHlfStatus() {
  logCurrentTime="$(date -u +%s)"	
  newStatus="$1"
  detail="$2"
  scriptStartTime=$3
  logElapsedTime=$(($logCurrentTime - $scriptStartTime))
  kubectl -n ${statusNamespace} create configmap hlf-status --from-literal hlfStatus="$newStatus" --from-literal hlfDescription="$detail Time elapsed: $logElapsedTime seconds" -o yaml --dry-run | kubectl replace -f -
  res=$?
  verifyResult $res "Updating 'hlf-status' configmap failed"
}

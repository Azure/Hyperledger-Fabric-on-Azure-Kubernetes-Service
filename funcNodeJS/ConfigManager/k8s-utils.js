module.exports = {
  createClient: function(base64EncodedKubernetesConfig) {
    // connection
    const Request = require("kubernetes-client/backends/request");

    const { Client, KubeConfig } = require("kubernetes-client");

    const kubeconfig = new KubeConfig();

    const config = Buffer.from(
      base64EncodedKubernetesConfig,
      "base64"
    ).toString();

    kubeconfig.loadFromString(config);
    const backend = new Request({
      kubeconfig
    });

    const aksClientVersion = "1.13";
    const client = new Client({
      backend,
      version: aksClientVersion
    });

    return client;
  }
};

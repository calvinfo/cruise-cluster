
var Table = require('easy-table');

/**
 * Module exports
 *
 * @param {Function} Cruise  cruise constructor to test against
 * @return {Function} Cluster
 */

module.exports = function(Cruise){

  /**
   * Create a new cluster with set addresses or given size.
   */

  function Cluster(addrs){
    if (!this instanceof Cluster) return new Cluster(addrs);
    if (typeof addrs === 'number') addrs = addresses(addrs);
    this.nodes = addrs.map(function(addr){
      var cruise = new Cruise(addr);
      addrs.forEach(cruise.peer.bind(cruise));
      cruise.connect();
      return cruise;
    });
  }

  /**
   * Kill `addr` node, or a random one.
   *
   * @param {String} addr
   */

  Cluster.prototype.kill = function(addr){
    var node = this.node(addr);
    node.stop();
    return node;
  };

  /**
   * Reboot the `addr` node and set it to reconnect after `timeout`
   *
   * @param {String} addr
   * @param {Number} timeout
   */

  Cluster.prototype.reboot = function(addr, timeout){
    if (typeof addr === 'number') timeout = addr, addr = null;
    var node = this.kill(addr);
    if (!timeout) timeout = 2000;
    setTimeout(function(){ node.connect() }, timeout);
  };

  /**
   * Stop the cluster!
   */

  Cluster.prototype.destroy = function(){
    this.nodes.forEach(function(node){
      node.stop();
    });
  };

  /**
   * Record a value to our state machine
   *
   * @param {Mixed} value
   * @param {Function} fn
   */

  Cluster.prototype.do = function(value, fn){
    var node = this.node();
    node.do(value, fn);
  };

  /**
   * Return the node matching `addr`, or a random node.
   *
   * @return {Node} node
   */

  Cluster.prototype.node = function(addr){
    var rand = Math.floor(this.nodes.length * Math.random());
    if (!addr) return this.nodes[rand];
    return this.nodes.filter(function(node){
      return node.addr() === addr;
    })[0];
  }

  /**
   * Return the list of common entries recorded to the cluster
   * which a majority of the nodes have commited
   *
   * @return {Array[Entries]} entries
   */

  Cluster.prototype.entries = function(){
    var node = this.synced()[0];
    return node.log().before(this.committed() + 1);
  };

  /**
   * Returns the commited index by the majority of the cluster
   *
   * @return {Number} committed
   */

  Cluster.prototype.committed = function(){
    var commits = this.nodes.map(function(node){
      return node.log().commitIndex();
    });
    commits.sort();
    return commits[this.quorum() - 1];
  }

  /**
   * Returns the size of the cluster
   *
   * @return {Number} size
   */

  Cluster.prototype.size = function(){
    return this.nodes.length;
  };

  /**
   * Return the size of the quorum for the cluster
   * @return {Number}
   */

  Cluster.prototype.quorum = function(){
    return Math.floor(this.size() / 2) + 1;
  };

  /**
   * Return the subset of nodes who are considered 'in-sync', meaning
   * that they have the commit index of the quorum of servers or
   * higher.
   *
   * @return {Array[Node]} nodes
   */

  Cluster.prototype.synced = function(){
    var committed = this.committed();
    return this.nodes.filter(function(node){
      return node.log().commitIndex() >= committed;
    });
  };

  /**
   * Return the summary for the cluster
   *
   * @return {String}
   */

  Cluster.prototype.inspect = function(){
    var table = new Table();
    this.nodes.forEach(function(node){
      var log = node.log();
      var entries = log.entries();

      table
        .cell('addr', node.addr())
        .cell('entries', entries.length)
        .cell('committed', log.commitIndex())
        .newRow();
    });
    return table.toString();
  };

  return Cluster;
};

/**
 * Return `length` number of addresses to listen on
 *
 * @param {Number} length
 * @return {Array[String]} addresses
 */

function addresses(length){
  var addrs = [];
  for (var i = 0; i < length; i++) {
    var port = 5000 + i;
    addrs.push('127.0.0.1:' + port);
  }
  return addrs;
}
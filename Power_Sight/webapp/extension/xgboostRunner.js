/**
 * XGBoost Runner (Lightweight JavaScript Inference)
 * Reads XGBoost JSON trees and evaluates them without needing heavy ML libraries.
 */

class XGBoostRunner {
  constructor(modelUrl = 'model_data.json') {
    this.modelUrl = modelUrl;
    this.trees = [];
    this.selectedFeatures = [];
    this.isReady = false;
  }

  async loadModel() {
    try {
      const url = chrome.runtime.getURL(this.modelUrl);
      const response = await fetch(url);
      const data = await response.json();
      this.trees = data.trees;
      this.selectedFeatures = data.selected_features;
      this.isReady = true;
      console.log(`[PowerSight] XGBoost Model loaded! Features: ${this.selectedFeatures.join(', ')}`);
    } catch (error) {
      console.error('[PowerSight] Failed to load XGBoost model:', error);
    }
  }

  predict(featuresObj) {
    if (!this.isReady || this.trees.length === 0) {
      console.warn('[PowerSight] Model not ready or empty');
      return 0.0;
    }

    // Traverse all trees and sum the leaf values
    let sum = 0;
    for (const tree of this.trees) {
      sum += this._evaluateTree(tree, featuresObj);
    }

    // XGBoost Binary Classification uses sigmoid function for probability
    const probability = 1.0 / (1.0 + Math.exp(-sum));
    return probability;
  }

  _evaluateTree(node, features) {
    // If it's a leaf node, return its weight
    if (node.leaf !== undefined) {
      return node.leaf;
    }

    // It's a split node. XGBoost often dumps features as "f0", "f1", etc.
    let featureName = node.split;
    if (featureName.startsWith('f')) {
      const idx = parseInt(featureName.substring(1), 10);
      if (!isNaN(idx) && idx < this.selectedFeatures.length) {
        featureName = this.selectedFeatures[idx];
      }
    }

    const splitValue = node.split_condition;
    const value = features[featureName] !== undefined ? features[featureName] : 0; // handle missing

    // Determine which child node to follow
    let nextNodeId;
    if (value < splitValue) {
      nextNodeId = node.yes;
    } else {
      nextNodeId = node.no;
    }

    // Missing values (if feature is missing or null)
    if (value === undefined || value === null || isNaN(value)) {
      nextNodeId = node.missing;
    }

    // Find the child node object
    const childNode = node.children.find(c => c.nodeid === nextNodeId);
    
    // Recursive evaluation
    return this._evaluateTree(childNode, features);
  }
}

// Attach to window
window.PowerSightXGBoostRunner = XGBoostRunner;

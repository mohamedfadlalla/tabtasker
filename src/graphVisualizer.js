// graphVisualizer.js
import logger from './logger.js';

export class GraphVisualizer {
  static async visualizeData(data) {
    try {
      const html = `<!DOCTYPE html>
        <html>
        <head>
          <title>Tab Knowledge Graphs</title>
          <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              background: #f5f5f5;
            }
            .loading {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(255, 255, 255, 0.9);
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              z-index: 1000;
            }
            .tab-container { 
              display: flex; 
              flex-wrap: wrap; 
              gap: 5px; 
              padding: 10px; 
              background: #f0f0f0; 
              border-radius: 4px;
              margin-bottom: 10px;
            }
            .tab-button { 
              padding: 8px 16px; 
              border: none; 
              background: #ddd; 
              cursor: pointer;
              border-radius: 4px;
              transition: all 0.3s ease;
            }
            .tab-button:hover {
              background: #1976D2;
              color: white;
            }
            .tab-button.active { 
              background: #2196F3; 
              color: white; 
            }
            .graph-container { 
              padding: 20px; 
              display: none; 
              height: 70vh;
              border: 1px solid #ddd;
              border-radius: 8px;
              background: white;
            }
            .graph-container.active { 
              display: block; 
            }
            .network-canvas {
              width: 100%;
              height: 100%;
              background: #fafafa;
            }
            #error-message {
              color: red;
              padding: 10px;
              margin: 10px 0;
              display: none;
              background: #fff3f3;
              border: 1px solid #ffcdd2;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div id="loading" class="loading">Loading visualization...</div>
          <div id="error-message"></div>
          <div class="tab-container" id="tabButtons"></div>
          <div id="graphContainers"></div>

          <script>
            // Check if vis.js is loaded
            if (typeof vis === 'undefined') {
              document.getElementById('error-message').style.display = 'block';
              document.getElementById('error-message').textContent = 'Error: vis.js library failed to load. Please check your internet connection and refresh the page.';
              document.getElementById('loading').style.display = 'none';
            } else {
              const data = ${JSON.stringify(data)};
              
              function createNetwork(groupId, container) {
                try {
                  console.log('Creating network for group:', groupId);
                  
                  const group = data.groups.find(function(g) { return g.group_id === groupId; });
                  const groupTabs = data.tabs.filter(function(t) { return t.group_id === groupId; });
                  const groupRelationships = data.relationships.filter(function(r) { return r.group_id === groupId; });

                  console.log('Group data:', { group, tabsCount: groupTabs.length, relationshipsCount: groupRelationships.length });
                  
                  if (!groupTabs.length) {
                    document.getElementById('error-message').style.display = 'block';
                    document.getElementById('error-message').textContent = 'No tabs found for group ' + groupId;
                    return null;
                  }

                  // Create nodes array
                  const nodes = new vis.DataSet(
                    groupTabs.map(function(tab) {
                      return {
                        id: tab.tab_id,
                        label: tab.title.substring(0, 30) + (tab.title.length > 30 ? '...' : ''),
                        title: tab.title, // hover tooltip
                        shape: 'dot',
                        size: 15,
                        font: {
                          size: 12,
                          color: '#333',
                          face: 'Arial'
                        },
                        color: {
                          background: '#2196F3',
                          border: '#1976D2',
                          highlight: {
                            background: '#1976D2',
                            border: '#0D47A1'
                          },
                          hover: {
                            background: '#42A5F5',
                            border: '#1976D2'
                          }
                        }
                      };
                    })
                  );
                  
                  // Create edges array
                  const edges = new vis.DataSet(
                    groupRelationships.map(function(rel) {
                      return {
                        from: rel.source_tab_id,
                        to: rel.target_tab_id,
                        label: rel.relationship,
                        font: {
                          size: 10,
                          color: '#666',
                          background: 'white',
                          strokeWidth: 0
                        },
                        arrows: {
                          to: {
                            enabled: true,
                            scaleFactor: 0.5
                          }
                        },
                        color: {
                          color: '#999',
                          highlight: '#666',
                          hover: '#666'
                        },
                        smooth: {
                          type: 'continuous'
                        }
                      };
                    })
                  );
                  
                  const options = {
                    physics: {
                      enabled: true,
                      barnesHut: {
                        gravitationalConstant: -2000,
                        centralGravity: 0.3,
                        springLength: 150,
                        springConstant: 0.04,
                        damping: 0.09
                      }
                    },
                    interaction: {
                      hover: true,
                      tooltipDelay: 200,
                      zoomView: true,
                      dragView: true
                    },
                    layout: {
                      improvedLayout: true,
                      randomSeed: 42
                    }
                  };
                  
                  console.log('Creating vis.Network instance');
                  const network = new vis.Network(container, { nodes, edges }, options);
                  
                  network.on('stabilizationProgress', function(params) {
                    const progress = Math.round(params.iterations / params.total * 100);
                    document.getElementById('loading').textContent = 'Stabilizing network... ' + progress + '%';
                  });

                  network.on('stabilizationIterationsDone', function() {
                    document.getElementById('loading').style.display = 'none';
                  });
                  
                  network.on('click', function(properties) {
                    const nodeId = properties.nodes[0];
                    if (nodeId) {
                      const tab = groupTabs.find(function(t) { return t.tab_id === nodeId; });
                      if (tab) {
                        try {
                          chrome.tabs.update(tab.id, { active: true }, function(updatedTab) {
                            if (chrome.runtime.lastError || !updatedTab) {
                              console.error('Error switching to tab:', chrome.runtime.lastError);
                              if (tab.url) {
                                window.open(tab.url, '_blank');
                              }
                            } else {
                              // Focus the window containing the tab
                              chrome.windows.update(updatedTab.windowId, { focused: true });
                            }
                          });
                        } catch (error) {
                          console.error('Error switching to tab:', error);
                          if (tab.url) {
                            window.open(tab.url, '_blank');
                          }
                        }
                      }
                    }
                  });

                  console.log('Network created successfully');
                  return network;
                } catch (error) {
                  console.error('Error creating network:', error);
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('error-message').textContent = 'Error creating network: ' + error.message;
                  document.getElementById('loading').style.display = 'none';
                  return null;
                }
              }

              function setupTabs() {
                try {
                  console.log('Setting up tabs');
                  const tabButtons = document.getElementById('tabButtons');
                  const graphContainers = document.getElementById('graphContainers');
                  const networks = new Map();
                  
                  if (!data.groups || !data.groups.length) {
                    document.getElementById('error-message').style.display = 'block';
                    document.getElementById('error-message').textContent = 'No groups found in data';
                    document.getElementById('loading').style.display = 'none';
                    return;
                  }

                  data.groups.forEach(function(group) {
                    const button = document.createElement('button');
                    button.className = 'tab-button';
                    button.textContent = group.title || 'Group ' + group.group_id;
                    button.onclick = function() { showGraph(group.group_id); };
                    tabButtons.appendChild(button);
                    
                    const container = document.createElement('div');
                    container.className = 'graph-container';
                    container.id = 'graph-' + group.group_id;
                    
                    const networkDiv = document.createElement('div');
                    networkDiv.className = 'network-canvas';
                    container.appendChild(networkDiv);
                    graphContainers.appendChild(container);
                    
                    const network = createNetwork(group.group_id, networkDiv);
                    if (network) {
                      networks.set(group.group_id, network);
                    }
                  });
                  
                  if (data.groups.length > 0) {
                    showGraph(data.groups[0].group_id);
                  }
                  
                  window.addEventListener('resize', function() {
                    networks.forEach(function(network) {
                      network.fit();
                    });
                  });

                  console.log('Tabs setup completed');
                } catch (error) {
                  console.error('Error in setupTabs:', error);
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('error-message').textContent = 'Error setting up visualization: ' + error.message;
                  document.getElementById('loading').style.display = 'none';
                }
              }
              
              function showGraph(groupId) {
                document.querySelectorAll('.tab-button').forEach(function(button) {
                  button.classList.remove('active');
                });
                document.querySelectorAll('.graph-container').forEach(function(container) {
                  container.classList.remove('active');
                });
                
                const activeButton = Array.from(document.querySelectorAll('.tab-button'))
                  .find(function(button) { return button.textContent.includes(groupId); });
                if (activeButton) activeButton.classList.add('active');
                
                const activeContainer = document.getElementById('graph-' + groupId);
                if (activeContainer) activeContainer.classList.add('active');
              }
              
              // Initialize visualization
              window.onload = function() {
                try {
                  console.log('Window loaded, starting setup');
                  setupTabs();
                } catch (error) {
                  console.error('Error during initialization:', error);
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('error-message').textContent = 'Error initializing visualization: ' + error.message;
                  document.getElementById('loading').style.display = 'none';
                }
              };
            }
          </script>
        </body>
        </html>`;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dataUrl = 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(html)));
      
      await chrome.tabs.create({ url: 'data:text/html;base64,' + btoa(unescape(encodeURIComponent(html))) });
      logger.info('Graph visualization opened in new tab');
      
      logger.info('Graph visualizations created');
    } catch (error) {
      logger.error('Failed to create graph visualizations:', error);
    }
  }
}
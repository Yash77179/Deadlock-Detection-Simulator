// Data structures to store processes and resources
let processes = new Set();
let resources = new Map(); // Map of resource ID to total units
let allocations = new Map(); // Map of process ID to Map of resource ID to allocated units
let requests = new Map(); // Map of process ID to Map of resource ID to requested units

// Theme management
let currentTheme = localStorage.getItem('deadlock-theme') || 'light';
let currentContrast = localStorage.getItem('deadlock-contrast') || 'normal';
document.documentElement.setAttribute('data-theme', currentTheme);
document.documentElement.setAttribute('data-contrast', currentContrast);

// Initialize cytoscape for graph visualization
let cy = cytoscape({
    container: document.getElementById('graph'),
    boxSelectionEnabled: false,
    autounselectify: true,
    style: [
        {
            selector: 'node',
            style: {
                'label': 'data(id)',
                'text-valign': 'bottom',
                'text-halign': 'center',
                'font-size': '16px',
                'font-weight': '600',
                'color': '#1f2937',
                'text-margin-y': 10,
                'overlay-opacity': 0
            }
        },
        {
            selector: 'node[type="process"]',
            style: {
                'background-color': '#4f46e5',
                'background-gradient-stop-colors': '#4f46e5 #6366f1 #818cf8',
                'background-gradient-stop-positions': '0% 50% 100%',
                'background-gradient-direction': 'to-bottom',
                'shape': 'ellipse',
                'width': '55px',
                'height': '55px',
                'border-width': '3px',
                'border-color': '#ffffff',
                'border-opacity': 1,
                'shadow-blur': 15,
                'shadow-color': 'rgba(79, 70, 229, 0.4)',
                'shadow-opacity': 0.8,
                'shadow-offset-x': 0,
                'shadow-offset-y': 2
            }
        },
        {
            selector: 'node[type="resource"]',
            style: {
                'background-color': '#059669',
                'background-gradient-stop-colors': '#059669 #10b981 #34d399',
                'background-gradient-stop-positions': '0% 50% 100%',
                'background-gradient-direction': 'to-bottom',
                'shape': 'round-rectangle',
                'width': '50px',
                'height': '50px',
                'border-width': '3px',
                'border-color': '#ffffff',
                'border-opacity': 1,
                'shadow-blur': 15,
                'shadow-color': 'rgba(5, 150, 105, 0.4)',
                'shadow-opacity': 0.8,
                'shadow-offset-x': 0,
                'shadow-offset-y': 2
            }
        },
        {
            selector: 'edge',
            style: {
                'width': 3,
                'line-color': '#334155',
                'target-arrow-color': '#334155',
                'target-arrow-shape': 'triangle',
                'curve-style': 'bezier',
                'arrow-scale': 1.2,
                'opacity': 0.8
            }
        },
        {
            selector: 'edge[type="request"]',
            style: {
                'line-style': 'dashed',
                'line-dash-pattern': [8, 4],
                'line-color': '#6366f1',
                'target-arrow-color': '#6366f1',
                'width': 2.5
            }
        },
        {
            selector: 'edge[type="allocation"]',
            style: {
                'line-color': '#059669',
                'target-arrow-color': '#059669',
                'width': 3
            }
        },
        {
            selector: 'node:selected',
            style: {
                'border-width': 4,
                'border-color': '#f97316',
                'border-opacity': 1
            }
        },
        {
            selector: 'edge:selected',
            style: {
                'width': 4,
                'line-color': '#f97316',
                'target-arrow-color': '#f97316'
            }
        }
    ]
});

// Helper function to log status messages
function logStatus(message) {
    const statusLog = document.getElementById('statusLog');
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry py-1 pl-3 text-neutral-700';
    logEntry.textContent = `[${timestamp}] ${message}`;
    statusLog.insertBefore(logEntry, statusLog.firstChild);
}

// Add a new process
function addProcess() {
    const processId = document.getElementById('processId').value.trim();
    if (!processId) {
        alert('Please enter a process ID');
        return;
    }
    if (processes.has(processId)) {
        alert('Process already exists');
        return;
    }

    processes.add(processId);
    allocations.set(processId, new Map());
    requests.set(processId, new Map());
    
    // Update UI
    updateProcessList();
    updateProcessSelect();
    updateGraph();
    logStatus(`Process "${processId}" created successfully`);
    document.getElementById('processId').value = '';
}

// Add a new resource
function addResource() {
    const resourceId = document.getElementById('resourceId').value.trim();
    const units = parseInt(document.getElementById('resourceUnits').value);
    
    if (!resourceId || isNaN(units) || units <= 0) {
        alert('Please enter valid resource ID and units');
        return;
    }
    if (resources.has(resourceId)) {
        alert('Resource already exists');
        return;
    }

    resources.set(resourceId, units);
    
    // Update UI
    updateResourceList();
    updateResourceSelect();
    updateGraph();
    logStatus(`Resource "${resourceId}" with ${units} units created successfully`);
    document.getElementById('resourceId').value = '';
    document.getElementById('resourceUnits').value = '';
}

// Request resources
function requestResource() {
    const processId = document.getElementById('processSelect').value;
    const resourceId = document.getElementById('resourceSelect').value;
    const units = parseInt(document.getElementById('units').value);

    if (!processId || !resourceId || isNaN(units) || units <= 0) {
        alert('Please select process, resource and enter valid units');
        return;
    }

    const availableUnits = getAvailableUnits(resourceId);
    if (units > availableUnits) {
        logStatus(`Process "${processId}" requesting ${units} units of "${resourceId}" (only ${availableUnits} available)`);
        requests.get(processId).set(resourceId, units);
    } else {
        // Allocate resources
        const currentAllocation = allocations.get(processId).get(resourceId) || 0;
        allocations.get(processId).set(resourceId, currentAllocation + units);
        logStatus(`Allocated ${units} units of "${resourceId}" to process "${processId}"`);
    }

    updateResourceList();
    updateGraph();
    document.getElementById('units').value = '';
}

// Release resources
function releaseResource() {
    const processId = document.getElementById('processSelect').value;
    const resourceId = document.getElementById('resourceSelect').value;
    const units = parseInt(document.getElementById('units').value);

    if (!processId || !resourceId || isNaN(units) || units <= 0) {
        alert('Please select process, resource and enter valid units');
        return;
    }

    const currentAllocation = allocations.get(processId).get(resourceId) || 0;
    if (units > currentAllocation) {
        alert(`Process ${processId} only has ${currentAllocation} units of ${resourceId}`);
        return;
    }

    // Release resources
    allocations.get(processId).set(resourceId, currentAllocation - units);
    if (currentAllocation - units === 0) {
        allocations.get(processId).delete(resourceId);
    }

    // Check if any waiting process can now be allocated
    checkWaitingProcesses(resourceId);

    updateResourceList();
    updateGraph();
    logStatus(`Released ${units} units of "${resourceId}" from process "${processId}"`);
    document.getElementById('units').value = '';
}

// Detect deadlock using cycle detection
function detectDeadlock() {
    const visited = new Set();
    const recursionStack = new Set();

    function hasCycle(processId) {
        if (!visited.has(processId)) {
            visited.add(processId);
            recursionStack.add(processId);

            // Check resources this process is waiting for
            const processRequests = requests.get(processId);
            for (const [resourceId, requestedUnits] of processRequests) {
                // Find processes holding this resource
                for (const [otherProcessId, otherAllocations] of allocations) {
                    if (otherAllocations.has(resourceId)) {
                        if (!visited.has(otherProcessId) && hasCycle(otherProcessId)) {
                            return true;
                        } else if (recursionStack.has(otherProcessId)) {
                            return true;
                        }
                    }
                }
            }
        }
        recursionStack.delete(processId);
        return false;
    }

    // Check each process for cycles
    let deadlockFound = false;
    let deadlockCycle = [];
    
    for (const processId of processes) {
        visited.clear();
        recursionStack.clear();
        if (hasCycle(processId)) {
            deadlockFound = true;
            deadlockCycle = Array.from(recursionStack);
            break;
        }
    }

    if (deadlockFound) {
        const cycleStr = deadlockCycle.join(' → ');
        logStatus(`Deadlock detected! Cycle: ${cycleStr}`);
        
        // Highlight deadlock cycle in graph
        cy.elements().removeClass('highlighted');
        deadlockCycle.forEach((nodeId, index) => {
            const nextNodeId = deadlockCycle[(index + 1) % deadlockCycle.length];
            cy.getElementById(nodeId).addClass('highlighted');
            
            // Find the edge between these nodes
            cy.edges().forEach(edge => {
                if ((edge.source().id() === nodeId && edge.target().id() === nextNodeId) ||
                    (edge.target().id() === nodeId && edge.source().id() === nextNodeId)) {
                    edge.addClass('highlighted');
                }
            });
        });
    } else {
        cy.elements().removeClass('highlighted');
        logStatus('No deadlock detected');
    }
}

// Helper function to get available units of a resource
function getAvailableUnits(resourceId) {
    const totalUnits = resources.get(resourceId);
    let allocatedUnits = 0;
    for (const [_, processAllocations] of allocations) {
        allocatedUnits += processAllocations.get(resourceId) || 0;
    }
    return totalUnits - allocatedUnits;
}

// Helper function to check waiting processes
function checkWaitingProcesses(resourceId) {
    let changed;
    do {
        changed = false;
        for (const [processId, processRequests] of requests) {
            const requestedUnits = processRequests.get(resourceId);
            if (requestedUnits && requestedUnits <= getAvailableUnits(resourceId)) {
                // Allocate resources to waiting process
                const currentAllocation = allocations.get(processId).get(resourceId) || 0;
                allocations.get(processId).set(resourceId, currentAllocation + requestedUnits);
                processRequests.delete(resourceId);
                logStatus(`Allocated ${requestedUnits} units of "${resourceId}" to waiting process "${processId}"`);
                changed = true;
            }
        }
    } while (changed);
}

// UI update functions
function updateProcessList() {
    const processList = document.getElementById('processList');
    processList.innerHTML = '';
    for (const processId of processes) {
        const li = document.createElement('li');
        li.className = 'process-item py-2 px-3 text-sm';
        li.textContent = processId;
        processList.appendChild(li);
    }
    
    // Show empty state if no processes
    if (processes.size === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'py-3 px-3 text-sm text-neutral-500 italic text-center';
        emptyState.textContent = 'No processes yet';
        processList.appendChild(emptyState);
    }
}

function updateResourceList() {
    const resourceList = document.getElementById('resourceList');
    resourceList.innerHTML = '';
    for (const [resourceId, totalUnits] of resources) {
        const availableUnits = getAvailableUnits(resourceId);
        const li = document.createElement('li');
        li.className = 'resource-item py-2 px-3 text-sm flex justify-between items-center';
        
        const resourceText = document.createElement('span');
        resourceText.textContent = resourceId;
        
        const unitsBadge = document.createElement('span');
        unitsBadge.className = 'bg-neutral-200 text-neutral-700 px-2 py-1 rounded-full text-xs';
        unitsBadge.textContent = `${availableUnits}/${totalUnits} units`;
        
        li.appendChild(resourceText);
        li.appendChild(unitsBadge);
        resourceList.appendChild(li);
    }
    
    // Show empty state if no resources
    if (resources.size === 0) {
        const emptyState = document.createElement('li');
        emptyState.className = 'py-3 px-3 text-sm text-neutral-500 italic text-center';
        emptyState.textContent = 'No resources yet';
        resourceList.appendChild(emptyState);
    }
}

function updateProcessSelect() {
    const processSelect = document.getElementById('processSelect');
    processSelect.innerHTML = '<option value="" disabled selected>Select Process</option>';
    for (const processId of processes) {
        const option = document.createElement('option');
        option.value = processId;
        option.textContent = processId;
        processSelect.appendChild(option);
    }
}

function updateResourceSelect() {
    const resourceSelect = document.getElementById('resourceSelect');
    resourceSelect.innerHTML = '<option value="" disabled selected>Select Resource</option>';
    for (const [resourceId] of resources) {
        const option = document.createElement('option');
        option.value = resourceId;
        option.textContent = resourceId;
        resourceSelect.appendChild(option);
    }
}

function updateGraph() {
    cy.elements().remove();
    
    // Add process nodes
    for (const processId of processes) {
        cy.add({
            data: {
                id: processId,
                type: 'process'
            }
        });
    }
    
    // Add resource nodes
    for (const [resourceId] of resources) {
        cy.add({
            data: {
                id: resourceId,
                type: 'resource'
            }
        });
    }
    
    // Add allocation edges
    for (const [processId, processAllocations] of allocations) {
        for (const [resourceId, units] of processAllocations) {
            cy.add({
                data: {
                    id: `${resourceId}-${processId}`,
                    source: resourceId,
                    target: processId,
                    type: 'allocation',
                    units: units
                }
            });
        }
    }
    
    // Add request edges
    for (const [processId, processRequests] of requests) {
        for (const [resourceId, units] of processRequests) {
            cy.add({
                data: {
                    id: `${processId}-${resourceId}`,
                    source: processId,
                    target: resourceId,
                    type: 'request',
                    units: units
                }
            });
        }
    }

    // Choose the appropriate layout based on the number of nodes
    let layoutOptions;
    const nodeCount = cy.nodes().length;
    
    if (nodeCount <= 6) {
        // For small graphs, circle layout works well
        layoutOptions = {
            name: 'circle',
            padding: 30,
            animate: true,
            animationDuration: 800,
            animationEasing: 'ease-in-out'
        };
    } else if (processes.size > 0 && resources.size > 0) {
        // For more complex graphs with both processes and resources, use a grid layout
        // with processes on one side and resources on the other
        layoutOptions = {
            name: 'grid',
            condense: true,
            rows: 2,
            cols: Math.max(processes.size, resources.size),
            position: function(node) {
                // Place processes in the top row, resources in the bottom row
                if (node.data('type') === 'process') {
                    return { row: 0 };
                } else {
                    return { row: 1 };
                }
            },
            animate: true,
            animationDuration: 800,
            animationEasing: 'ease-in-out'
        };
    } else {
        // Default to a force-directed layout for other cases
        layoutOptions = {
            name: 'cose',
            idealEdgeLength: 120,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 4500,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 80,
            numIter: 1000,
            animate: true,
            animationDuration: 800,
            animationEasing: 'ease-in-out'
        };
    }
    
    cy.layout(layoutOptions).run();
    
    // Add styles for highlighted elements (for deadlock detection)
    cy.style()
        .selector('node.highlighted')
        .style({
            'border-width': 4,
            'border-color': '#ef4444',
            'border-opacity': 1,
            'shadow-blur': 20,
            'shadow-color': '#ef4444',
            'shadow-opacity': 0.8,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0,
            'animation-duration': '1.5s',
            'animation-name': 'pulse',
            'animation-timing-function': 'ease-in-out',
            'animation-iteration-count': 'infinite'
        })
        .selector('edge.highlighted')
        .style({
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'width': 4,
            'shadow-blur': 10,
            'shadow-color': '#ef4444',
            'shadow-opacity': 0.8,
            'arrow-scale': 1.5,
            'opacity': 1
        })
        .update();
        
    // Add interactivity 
    cy.nodes().on('mouseover', function(e) {
        e.target.animate({
            style: { 
                'width': function(node) { return node.style('width') * 1.1; },
                'height': function(node) { return node.style('height') * 1.1; }
            },
            duration: 200
        });
    });
    
    cy.nodes().on('mouseout', function(e) {
        e.target.animate({
            style: { 
                'width': function(node) { 
                    return node.data('type') === 'process' ? '55px' : '50px';
                },
                'height': function(node) { 
                    return node.data('type') === 'process' ? '55px' : '50px';
                }
            },
            duration: 200
        });
    });
}

// Update the graph styles based on the current theme and contrast
function updateGraphTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const isHighContrast = document.documentElement.getAttribute('data-contrast') === 'high';
    
    // Define colors based on theme and contrast
    let nodeTextColor, nodeOutlineColor, processColor1, processColor2, resourceColor1, resourceColor2, edgeColor;
    
    if (isHighContrast) {
        if (isDark) {
            // High contrast dark mode
            nodeTextColor = '#ffffff';
            nodeOutlineColor = '#000000';
            processColor1 = '#ffffff';
            processColor2 = '#ffffff';
            resourceColor1 = '#ffffff';
            resourceColor2 = '#ffffff';
            edgeColor = '#ffffff';
        } else {
            // High contrast light mode
            nodeTextColor = '#000000';
            nodeOutlineColor = '#ffffff';
            processColor1 = '#000000';
            processColor2 = '#000000';
            resourceColor1 = '#000000';
            resourceColor2 = '#000000';
            edgeColor = '#000000';
        }
    } else {
        // Normal contrast
        if (isDark) {
            nodeTextColor = '#f3f4f6';
            nodeOutlineColor = '#1f2937';
            processColor1 = 'var(--process-color-1)';
            processColor2 = 'var(--process-color-2)';
            resourceColor1 = 'var(--resource-color-1)';
            resourceColor2 = 'var(--resource-color-2)';
            edgeColor = '#9ca3af';
        } else {
            nodeTextColor = '#1f2937';
            nodeOutlineColor = '#000000';
            processColor1 = '#4f46e5';
            processColor2 = '#818cf8';
            resourceColor1 = '#059669';
            resourceColor2 = '#34d399';
            edgeColor = '#334155';
        }
    }
    
    // Update node styles
    cy.style()
        .selector('node')
        .style({
            'color': nodeTextColor,
            'text-outline-width': isDark ? 3 : 2,
            'text-outline-color': isDark ? '#1f2937' : '#ffffff',
            'text-outline-opacity': isDark ? 0.9 : 0.5,
            'font-weight': isDark ? '700' : '600',
            'shadow-blur': isDark && !isHighContrast ? 10 : 5,
            'shadow-opacity': isDark && !isHighContrast ? 0.5 : 0.3,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0
        })
        .selector('node[type="process"]')
        .style({
            'background-gradient-stop-colors': isHighContrast ? 
                `${processColor1} ${processColor1} ${processColor1}` :
                `${processColor1} ${processColor1} ${processColor2}`,
            'border-color': nodeOutlineColor,
            'border-width': isDark ? 3 : 2,
            'border-opacity': 1,
            'shadow-color': isHighContrast ? 
                (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)') :
                (isDark ? 'rgba(99, 102, 241, 0.6)' : 'rgba(79, 70, 229, 0.4)')
        })
        .selector('node[type="resource"]')
        .style({
            'background-gradient-stop-colors': isHighContrast ? 
                `${resourceColor1} ${resourceColor1} ${resourceColor1}` :
                `${resourceColor1} ${resourceColor1} ${resourceColor2}`,
            'border-color': nodeOutlineColor,
            'border-width': isDark ? 3 : 2,
            'border-opacity': 1,
            'shadow-color': isHighContrast ? 
                (isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)') :
                (isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.4)')
        })
        .selector('edge')
        .style({
            'line-color': edgeColor,
            'target-arrow-color': edgeColor,
            'opacity': isDark ? 0.9 : 0.8,
            'width': isDark ? 2.5 : 2
        })
        .selector('edge[type="request"]')
        .style({
            'line-color': isHighContrast ? edgeColor : (isDark ? 'var(--process-color-2)' : '#6366f1'),
            'target-arrow-color': isHighContrast ? edgeColor : (isDark ? 'var(--process-color-2)' : '#6366f1'),
            'width': isDark ? 3 : 2.5
        })
        .selector('edge[type="allocation"]')
        .style({
            'line-color': isHighContrast ? edgeColor : (isDark ? 'var(--resource-color-2)' : '#059669'),
            'target-arrow-color': isHighContrast ? edgeColor : (isDark ? 'var(--resource-color-2)' : '#059669'),
            'width': isDark ? 3.5 : 3
        })
        .selector('node.highlighted')
        .style({
            'border-color': isHighContrast ? (isDark ? '#ffffff' : '#000000') : '#ef4444',
            'border-width': 5,
            'shadow-color': isHighContrast ? (isDark ? '#ffffff' : '#000000') : '#ef4444',
            'shadow-opacity': isDark ? 1 : 0.8,
            'shadow-blur': isDark ? 25 : 20
        })
        .selector('edge.highlighted')
        .style({
            'line-color': isHighContrast ? (isDark ? '#ffffff' : '#000000') : '#ef4444',
            'target-arrow-color': isHighContrast ? (isDark ? '#ffffff' : '#000000') : '#ef4444',
            'width': isDark ? 5 : 4,
            'opacity': 1
        })
        .selector(':selected')
        .style({
            'border-color': isDark ? '#6366f1' : '#4f46e5',
            'border-width': isDark ? 4 : 3,
            'shadow-color': isDark ? '#6366f1' : '#4f46e5',
            'shadow-opacity': isDark ? 0.8 : 0.6,
            'shadow-blur': isDark ? 20 : 15,
            'shadow-offset-x': 0,
            'shadow-offset-y': 0
        })
        .update();
}

// Toggle theme function
function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('deadlock-theme', newTheme);
    currentTheme = newTheme;
    updateGraphTheme();
}

// Toggle contrast function
function toggleContrast() {
    const newContrast = currentContrast === 'normal' ? 'high' : 'normal';
    document.documentElement.setAttribute('data-contrast', newContrast);
    localStorage.setItem('deadlock-contrast', newContrast);
    currentContrast = newContrast;
    updateGraphTheme();
}

// Initialize the UI
document.addEventListener('DOMContentLoaded', function() {
    updateProcessList();
    updateResourceList();
    updateProcessSelect();
    updateResourceSelect();
    
    // Make sure graph container is properly sized
    const graphContainer = document.getElementById('graph');
    if (graphContainer) {
        // Resize cytoscape when window is resized
        window.addEventListener('resize', function() {
            cy.resize();
            cy.fit();
        });
    }
    
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Contrast toggle functionality
    const contrastToggle = document.getElementById('contrastToggle');
    if (contrastToggle) {
        contrastToggle.addEventListener('click', toggleContrast);
    }
    
    // Set initial theme
    updateGraphTheme();
}); 
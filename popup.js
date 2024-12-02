// State management
let state = {
    isCustomMode: false,
    projects: [],
    isClassifying: false
};

// DOM Elements
const elements = {
    modeToggle: document.getElementById('modeToggle'),
    customModeContainer: document.getElementById('customModeContainer'),
    projectName: document.getElementById('projectName'),
    projectDescription: document.getElementById('projectDescription'),
    addProject: document.getElementById('addProject'),
    projectsList: document.getElementById('projectsList'),
    groupTabs: document.getElementById('groupTabs'),
    visualizeData: document.getElementById('visualizeData'),
    status: document.getElementById('status')
};

async function visualizeData() {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'visualizeData'
        });
        
        showStatus(
            response.success ? 'Data visualization completed' : response.message,
            !response.success
        );
    } catch (error) {
        showStatus('Error visualizing data', true);
    }
}

// Load saved state
async function loadState() {
    try {
        const saved = await chrome.storage.sync.get(['isCustomMode', 'projects']);
        state.isCustomMode = saved.isCustomMode || false;
        state.projects = saved.projects || [];
        
        // Update UI
        elements.modeToggle.checked = state.isCustomMode;
        toggleCustomMode(state.isCustomMode);
        renderProjects();
    } catch (error) {
        showStatus('Error loading saved settings', true);
    }
}

// Save state
async function saveState() {
    try {
        await chrome.storage.sync.set({
            isCustomMode: state.isCustomMode,
            projects: state.projects
        });
    } catch (error) {
        showStatus('Error saving settings', true);
    }
}

// Toggle custom mode
function toggleCustomMode(enabled) {
    state.isCustomMode = enabled;
    elements.customModeContainer.classList.toggle('hidden', !enabled);
    elements.groupTabs.textContent = enabled ? 'Group by Projects' : 'Group Similar Tabs';
    saveState();
}

// Add project
function addProject() {
    const name = elements.projectName.value.trim();
    const description = elements.projectDescription.value.trim();
    
    if (!name) return;
    
    state.projects.push({ name, description });
    saveState();
    renderProjects();
    
    // Clear inputs
    elements.projectName.value = '';
    elements.projectDescription.value = '';
}

// Remove project
function removeProject(index) {
    state.projects.splice(index, 1);
    saveState();
    renderProjects();
}

// Render projects list
function renderProjects() {
    elements.projectsList.innerHTML = '';
    
    state.projects.forEach((project, index) => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.innerHTML = `
            <div class="project-info">
                <div class="project-name">${project.name}</div>
                ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
            </div>
            <button class="remove-project" title="Remove project">×</button>
        `;
        
        projectCard.querySelector('.remove-project').addEventListener('click', () => removeProject(index));
        elements.projectsList.appendChild(projectCard);
    });
}

// Show status message
function showStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? '#f44336' : '#666';
    setTimeout(() => {
        elements.status.textContent = '';
    }, 3000);
}

// Group tabs
async function groupTabs() {
    if (state.isClassifying) return;
    
    state.isClassifying = true;
    elements.groupTabs.disabled = true;
    elements.groupTabs.textContent = 'Grouping...';
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'groupTabs',
            mode: state.isCustomMode ? 'custom' : 'simple',
            projects: state.projects
        });
        
        showStatus(response.message, !response.success);
    } catch (error) {
        showStatus('Error grouping tabs', true);
    } finally {
        state.isClassifying = false;
        elements.groupTabs.disabled = false;
        elements.groupTabs.textContent = state.isCustomMode ? 'Group by Projects' : 'Group Similar Tabs';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', loadState);

elements.modeToggle.addEventListener('change', (e) => {
    toggleCustomMode(e.target.checked);
});

elements.addProject.addEventListener('click', addProject);

elements.projectName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addProject();
});

elements.groupTabs.addEventListener('click', groupTabs);

// viulization listener
elements.visualizeData.addEventListener('click', visualizeData);
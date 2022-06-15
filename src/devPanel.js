function createDevPanel() {
  const AUTOSAVE_KEY = 'dev-autosave';
  const SAVES_KEY = 'dev-saves';

  const devPanel = document.createElement('div');
  const heading = document.createElement('strong');
  const devPanelContent = document.createElement('div');
  devPanel.appendChild(heading);
  devPanel.appendChild(devPanelContent);

  devPanel.className = 'dev-panel';
  
  heading.textContent = 'Developer Tools';
  heading.style.cursor = 'pointer';
  $(heading).click(evt => {
    const $content = $(devPanelContent);
    $content[$content.is( ":hidden" ) ? 'slideDown' : 'slideUp']('fast');
  });

  document.body.appendChild(devPanel);

  function getSaves() {
    const json = window.localStorage.getItem(SAVES_KEY);
    if (!json) return [];
    try {
      return JSON.parse(json);
    } catch (err) {
      console.warn(`Failed to parse saves: `, err, json);
      return [];
    }
  }

  function getAutosave() {
    const json = window.localStorage.getItem(AUTOSAVE_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch (err) {
      console.warn(`Failed to parse autosave: `, err, json);
    }
  }

  function buildSave() {
    return {
      passageName: window.passage.name,
      saveHash: window.story.saveHash(),
      saveTime: Date.now()
    };
  }

  window.saveNow = devPanel.saveNow = () => {
    const saves = [buildSave(), ...getSaves()].slice(0, 5);
    window.localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
    devPanel.render();
  };

  devPanel.autosave = () => {
    window.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildSave()));
  }

  window.loadAutosave = devPanel.loadAutosave = () => {
    const autosave = getAutosave();
    window.story.restore(autosave.saveHash);
  };

  window.loadSave = devPanel.loadSave = (saveIndex) => {
    const save = getSaves()[saveIndex];
    window.story.restore(save.saveHash);
  };

  devPanel.render = () => {
    const content = [];
    content.push(`<hr />`);
    content.push(`<center><a href="javascript:saveNow()">[[ Save now ]]</a></center>`);
    const autosave = getAutosave();
    if (autosave) {
      content.push(`<a href="javascript:loadAutosave()">AUTOSAVE | ${autosave.passageName}</a>`);
    }
    getSaves().forEach((save, i) => {
      content.push(`<br /><a href="javascript:loadSave(${i})">${ago(save.saveTime)} | ${save.passageName}</a>`);
    });
    devPanelContent.innerHTML = content.join('\n');
  }

  devPanel.render();
  return devPanel;
}

function ago(ms) {
  var secs = Math.floor((Date.now() - ms) / 1000);
  if (secs < 5) { return "just now"; }
  if (secs < 60) { return secs + "s ago"; }
  if (secs < 3600) { return Math.floor(secs / 60) + "m ago"; }
  if (secs < 86400) { return Math.floor(secs / 3600) + "h ago"; }
  if (secs < 604800) { return Math.floor(secs / 172800) + "d ago"; }
  if (secs < 31536000) { return Math.floor(secs / 2592000) + "mo ago"; }
  return "more than year ago";
}
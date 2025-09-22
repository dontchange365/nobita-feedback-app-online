// navigation.js

function pathJoin(...args) {
  return args.join('/').replace(/\/+/g,'/').replace(/\/$/,'') || '/';
}

function goBack(currentPath, parentPath) {
  if (currentPath && currentPath !== '/' && parentPath) {
    loadDir(parentPath);
  } else {
    console.log("पहले से ही root directory पर हैं।");
  }
}

function renderBreadcrumbBar(path) {
  const bar = document.getElementById('breadcrumb-bar');
  bar.innerHTML = '';
  let fullPathAccumulator = '';

  const rootBtn = document.createElement('span');
  rootBtn.className = 'breadcrumb-link breadcrumb-root';
  rootBtn.textContent = 'ROOT';
  rootBtn.onclick = () => { loadDir('/'); };
  bar.appendChild(rootBtn);

  let segments = path.replace(/^\/+/,'').split('/').filter(Boolean);

  if (segments.length > 0) {
    const sep = document.createElement('span');
    sep.textContent = '/';
    sep.className = 'breadcrumb-sep';
    bar.appendChild(sep);
  }

  segments.forEach((seg, idx) => {
    fullPathAccumulator += '/' + seg;
    const link = document.createElement('span');
    link.className = 'breadcrumb-link';
    link.textContent = seg;
    const currentSegmentPath = fullPathAccumulator;
    link.onclick = () => { loadDir(currentSegmentPath); };
    bar.appendChild(link);
    if (idx < segments.length - 1) {
      const sep = document.createElement('span');
      sep.textContent = '/';
      sep.className = 'breadcrumb-sep';
      bar.appendChild(sep);
    }
  });

  setTimeout(() => {
    bar.scrollLeft = bar.scrollWidth;
  }, 100);
}
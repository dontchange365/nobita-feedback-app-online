// This file contains the entire breadcrumb logic, separated from main.js

// Breadcrumb trail ko local storage mein store karne ke liye key
const BREADCRUMB_STORAGE_KEY = 'nobitaBreadcrumbTrail';

// --- HELPER FUNCTIONS ---
// Segment name se ".html" remove karna aur capitalize karna
function getCleanTitle(segment) {
    let displayText = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    if (displayText.toLowerCase().endsWith('.html')) {
        displayText = displayText.slice(0, -5); // Remove ".html" extension
    }
    return displayText;
}

// URL path ko normalize karega: .html hataega, trailing slash add/remove karega
function normalizePath(path) {
    // 1. .html extension remove karein
    let normalized = path.replace(/\.html$/i, '');

    // 2. Trailing slash (/) ko handle karein. Root '/' ko chhodkar.
    // Agar path sirf '/' hai, toh use वैसा ही rehne dein.
    // Agar normalized path empty string ban gaya hai (jaise sirf '.html' tha), toh '/' return karein.
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    // Agar path '/index' ya 'index' ya empty string tha toh use '/' bana dein
    if (normalized === '' || normalized.toLowerCase() === '/index') {
        return '/';
    }
    return normalized;
}

// Inferred parent relationships ke liye mapping
// Agar aapki files flat structure mein hain (jaise 'rdp-connect.html' root mein),
// aur aap chahte hain ki breadcrumb mein uska koi 'parent' dikhe jo URL mein nahi hai,
// toh yahan us relation ko define karein.
const INFERRED_HIERARCHY_MAP = {
    // 'child-page-normalized-name': { title: 'Parent Category Name', normalizedUrl: '/parent-category-normalized-url' },
    // Dhyan dein: yahan key aur url normalized hone chahiye
    'rdp-connect': { title: 'RDP', normalizedUrl: '/rdp' },
    // Example: agar aapke paas 'about-us.html' hai aur aap usko 'Company > About Us' dikhana chahte hain
    // aur 'company.html' bhi hai: 'about-us': { title: 'Company', normalizedUrl: '/company' },
};


// --- MAIN BREADCRUMB LOGIC ---
function generateDynamicBreadcrumbs() {
    // Purane breadcrumbs container ko hata dein taaki duplicate na bane
    const existingBreadcrumbs = document.getElementById('dynamic-breadcrumbs');
    if (existingBreadcrumbs) {
        existingBreadcrumbs.remove();
    }

    const currentPathname = window.location.pathname;
    // Current URL path ko normalize karein
    const normalizedCurrentPath = normalizePath(currentPathname);

    const isHomePage = (normalizedCurrentPath === '/');

    let breadcrumbTrail = JSON.parse(localStorage.getItem(BREADCRUMB_STORAGE_KEY)) || [];
    let updatedTrail = [];

    // Current page ki information taiyar karein (normalized URL aur title ke saath)
    const currentPageFileName = normalizedCurrentPath.split('/').pop(); // Normalized path ka last segment
    const currentPageInfo = {
        url: normalizedCurrentPath,
        title: getCleanTitle(currentPageFileName || 'Home')
    };
    if (isHomePage) {
        currentPageInfo.title = 'Home';
        currentPageInfo.url = '/'; // Home page ka URL consistent rakhein
    }

    // 1. Trail Management Logic
    if (isHomePage) {
        // Agar current page Home hai, toh trail ko sirf Home par reset karein
        updatedTrail = [{ title: 'Home', url: '/' }];
    } else {
        // Current page ko trail mein dhoondein (normalized URL ke basis par)
        const existingIndex = breadcrumbTrail.findIndex(item => item.url === currentPageInfo.url);

        if (existingIndex !== -1) {
            // Agar page trail mein mil gaya (yaani back/forward button se aaye ya dubara visit kiya),
            // toh trail ko us point tak truncate karein
            updatedTrail = breadcrumbTrail.slice(0, existingIndex + 1);
        } else {
            // Page naya hai trail mein
            updatedTrail = [...breadcrumbTrail]; // Existing trail copy karein

            // Inferred parent add karein agar applicable hai
            // yahan key normalizedCurrentPath ke filename part ka use karein
            const currentNormalizedFileName = normalizedCurrentPath.split('/').pop();
            if (INFERRED_HIERARCHY_MAP[currentNormalizedFileName.toLowerCase()]) {
                const inferredParent = INFERRED_HIERARCHY_MAP[currentNormalizedFileName.toLowerCase()];
                // Check karein ki inferred parent trail mein already nahi hai (normalized URL ke basis par)
                const parentInTrail = updatedTrail.some(item => item.url === inferredParent.normalizedUrl);

                // Agar inferred parent trail mein nahi hai aur hum Home se seedhe is inferred child par aaye hain,
                // toh inferred parent ko Home ke baad add karein.
                if (!parentInTrail && updatedTrail.length > 0 && updatedTrail[updatedTrail.length - 1].url === '/') {
                    updatedTrail.push({
                        title: inferredParent.title,
                        url: inferredParent.normalizedUrl
                    });
                }
            }

            // Current page ko trail mein add karein, ensure no duplicates at the very end
            // Dhyan dein: yahan check normalizedCurrentPath/currentPageInfo.url se hoga
            if (updatedTrail.length === 0 || updatedTrail[updatedTrail.length - 1].url !== currentPageInfo.url) {
                updatedTrail.push(currentPageInfo);
            }
        }
    }

    // Local storage mein updated trail save karein
    localStorage.setItem(BREADCRUMB_STORAGE_KEY, JSON.stringify(updatedTrail));

    // 2. Breadcrumb Rendering Logic
    renderBreadcrumbs(updatedTrail);
}

// Separate function to render the breadcrumbs HTML
function renderBreadcrumbs(trailToRender) {
    const breadcrumbContainer = document.createElement('nav');
    breadcrumbContainer.id = 'dynamic-breadcrumbs';
    breadcrumbContainer.style.cssText = `
        margin: 10px 0 5px 0;
        padding: 0 0px;
        background-color: transparent;
        border-radius: 0;
        box-shadow: none;
        font-family: 'Poppins', sans-serif;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        font-size: 0.9em;
        width: 100%;
        box-sizing: border-box;
    `;

    const breadcrumbList = document.createElement('ol');
    breadcrumbList.style.cssText = `
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        width: 100%;
        justify-content: flex-start;
    `;

    trailToRender.forEach((item, index) => {
        if (index > 0) {
            const separator = document.createElement('li');
            separator.textContent = '>';
            separator.style.cssText = `
                margin: 0 6px;
                color: #6c757d;
                font-weight: 600;
                user-select: none;
            `;
            breadcrumbList.appendChild(separator);
        }

        const listItem = document.createElement('li');
        if (index === trailToRender.length - 1) {
            const span = document.createElement('span');
            span.textContent = item.title;
            span.style.cssText = `
                color: #495057;
                font-weight: 600;
                cursor: default;
                white-space: nowrap;
            `;
            listItem.appendChild(span);
        } else {
            const link = document.createElement('a');
            link.href = item.url;
            link.textContent = item.title;
            link.style.cssText = `
                text-decoration: none;
                color: #007bff;
                font-weight: 500;
                transition: color 0.3s ease;
                white-space: nowrap;
            `;
            link.onmouseover = function() { this.style.color = '#0056b3'; };
            link.onmouseout = function() { this.style.color = '#007bff'; };
            listItem.appendChild(link);
        }
        breadcrumbList.appendChild(listItem);
    });

    if (trailToRender.length === 1 && trailToRender[0].url === '/') {
        const separator = document.createElement('li');
        separator.textContent = '>';
        separator.style.cssText = `
            margin: 0 6px;
            color: #6c757d;
            font-weight: 600;
            user-select: none;
        `;
        breadcrumbList.appendChild(separator);
    }
    breadcrumbContainer.appendChild(breadcrumbList);
    const fancyDivider = document.querySelector('.fancy-divider');
    const heroSection = document.querySelector('.hero-section');
    if (fancyDivider) {
        fancyDivider.insertAdjacentElement('afterend', breadcrumbContainer);
    } else if (heroSection && heroSection.parentNode) {
        heroSection.parentNode.insertBefore(breadcrumbContainer, heroSection);
    } else {
        document.body.prepend(breadcrumbContainer);
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', generateDynamicBreadcrumbs);
window.addEventListener('popstate', generateDynamicBreadcrumbs);
// --- Blog Content Cycling & Animation ---
let allBlogs = [];
let currentBlogIndex = 0;
const blogDisplayElement = document.getElementById('blog-content-display');
const blogTitleElement = blogDisplayElement ? blogDisplayElement.querySelector('.animated-blog-title') : null;
const blogSummaryElement = blogDisplayElement ? blogDisplayElement.querySelector('.animated-blog-summary') : null;
const blogButtonElement = document.getElementById('blog-read-more-btn'); // Get the new button element
let blogCycleInterval;

const animationClasses = ['fade-in-slide-up', 'fade-in-scale']; // Different entry animations

function applyExitAnimation(element, animationClass) {
    return new Promise(resolve => {
        if (!element) {
            resolve();
            return;
        }
        const exitClass = animationClass.replace('in', 'out');
        element.classList.add(exitClass);
        const onAnimationEnd = () => {
            element.classList.remove(exitClass);
            element.removeEventListener('animationend', onAnimationEnd);
            resolve();
        };
        element.addEventListener('animationend', onAnimationEnd);
        // Fallback for cases where animationend might not fire (e.g., element hidden quickly)
        setTimeout(() => {
            if (element.classList.contains(exitClass)) {
                element.classList.remove(exitClass);
                resolve();
            }
        }, 800); // Animation duration is 0.8s
    });
}

async function displayNextBlog() {
    if (!blogDisplayElement || !blogTitleElement || !blogSummaryElement || !blogButtonElement) {
        console.warn("Blog display elements or button not found. Cannot display blogs.");
        return;
    }

    if (!allBlogs.length) {
        blogTitleElement.textContent = "No blogs available yet.";
        blogSummaryElement.textContent = "Check back soon for new content!";
        blogButtonElement.style.display = 'none'; // Hide button if no blogs
        return;
    }

    const nextBlog = allBlogs[currentBlogIndex];
    const currentAnimationClass = animationClasses[Math.floor(Math.random() * animationClasses.length)];

    // Apply exit animation if content is visible and not initial loading message
    if (blogTitleElement.textContent !== "Loading Latest Content..." && blogTitleElement.textContent !== "No blogs available yet." && blogTitleElement.textContent !== "Failed to load content.") {
        await applyExitAnimation(blogDisplayElement, currentAnimationClass);
    }
    blogDisplayElement.classList.remove(...animationClasses.map(cls => cls.replace('in', 'out')));


    // Update content and button link
    blogTitleElement.textContent = nextBlog.title;
    blogSummaryElement.textContent = nextBlog.summary;
    blogButtonElement.href = nextBlog.link || '#'; // Set the link for the button
    blogButtonElement.style.display = 'inline-flex'; // Show the button
    if (nextBlog.link) {
         blogButtonElement.onclick = (event) => {
            event.stopPropagation(); // Prevent the container's onclick from firing
            window.open(nextBlog.link, '_blank'); // Open blog in new tab
        };
    } else {
        blogButtonElement.onclick = null; // No action if no link
    }


    // Apply entry animation
    blogDisplayElement.classList.add(currentAnimationClass);
    const onAnimationEnd = () => {
        blogDisplayElement.classList.remove(currentAnimationClass);
        blogDisplayElement.removeEventListener('animationend', onAnimationEnd);
    };
    blogDisplayElement.addEventListener('animationend', onAnimationEnd);

    currentBlogIndex = (currentBlogIndex + 1) % allBlogs.length;
}

// Main blog fetch logic, now only populates allBlogs for animated container
async function loadBlogs() {
    // Show initial loading message in the animated container
    if (blogTitleElement) {
        blogTitleElement.textContent = "Loading Latest Content...";
        blogSummaryElement.textContent = "Please wait while we fetch the freshest updates for you.";
        if(blogButtonElement) blogButtonElement.style.display = 'none'; // Hide button during initial load
    }

    let cachedBlogs = [];
    // Try to load from local storage first
    if(localStorage.getItem('nobi_blogs')){
        try {
            cachedBlogs = JSON.parse(localStorage.getItem('nobi_blogs'));
            if (cachedBlogs.length > 0) {
                allBlogs = cachedBlogs; // Set blogs for animated container
                displayNextBlog(); // Display first blog in animated container
                blogCycleInterval = setInterval(displayNextBlog, 7000); // Cycle every 7 seconds
            }
        } catch(e) {
            console.error("Error parsing cached blogs:", e);
            localStorage.removeItem('nobi_blogs');
        }
    }

    // Always try to fetch latest from server
    try {
        const res = await fetch('/api/blogs');
        if(res.ok) {
            const latest = await res.json();
            // Only update cache and re-render if new data is different
            if (JSON.stringify(latest) !== localStorage.getItem('nobi_blogs')) {
                localStorage.setItem('nobi_blogs', JSON.stringify(latest));
                allBlogs = latest; // Update blogs for animated container
                if (blogDisplayElement && allBlogs.length > 0) {
                    clearInterval(blogCycleInterval); // Clear existing interval
                    currentBlogIndex = 0; // Reset index to start from first new blog
                    displayNextBlog(); // Display first blog of new set
                    blogCycleInterval = setInterval(displayNextBlog, 7000);
                } else if (blogDisplayElement && allBlogs.length === 0) { // If no blogs received
                    clearInterval(blogCycleInterval);
                    blogTitleElement.textContent = "No blogs available yet.";
                    blogSummaryElement.textContent = "Check back soon for new content!";
                    if(blogButtonElement) blogButtonElement.style.display = 'none';
                }
            } else if (cachedBlogs.length === 0 && latest.length > 0) {
                // If nothing was in cache initially but server has data, use it
                allBlogs = latest;
                if (blogDisplayElement) {
                    displayNextBlog();
                    blogCycleInterval = setInterval(displayNextBlog, 7000);
                }
            } else if (latest.length === 0 && cachedBlogs.length > 0) {
                // If server returns no blogs, but cache had some, clear cache and update UI
                localStorage.removeItem('nobi_blogs');
                allBlogs = []; // Clear for animated container
                clearInterval(blogCycleInterval);
                if (blogDisplayElement) {
                    blogTitleElement.textContent = "Network Error.";
                    blogSummaryElement.textContent = "Could not load content.";
                    if(blogButtonElement) blogButtonElement.style.display = 'none';
                }
            }
        } else {
            console.error("Failed to fetch latest blogs from server:", res.status, res.statusText);
            if (blogDisplayElement && !allBlogs.length) { // Also update animated container if empty
                blogTitleElement.textContent = "Failed to load content.";
                blogSummaryElement.textContent = "Please try refreshing the page.";
                if(blogButtonElement) blogButtonElement.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Network error fetching blogs:", error);
        if (blogDisplayElement && !allBlogs.length) { // Also update animated container if empty
            blogTitleElement.textContent = "Network Error.";
            blogSummaryElement.textContent = "Could not load content.";
            if(blogButtonElement) blogButtonElement.style.display = 'none';
        }
    }
}
window.loadBlogs = loadBlogs;


// script.js (Locate this existing block in your file)

document.addEventListener('DOMContentLoaded', () => {
    loadBlogs();
});
  
  
  
      // --- Canvas Starfield ---
        const canvas = document.getElementById('starfield-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null; // Check if canvas exists
        let stars = [];
        const numStars = 150; // Increased number of stars for denser field

        function resizeCanvas() {
            if (!canvas || !ctx) return; // Ensure canvas and context exist
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            initStars();
        }
        window.resizeCanvas = resizeCanvas;

        function initStars() {
            stars = [];
            for (let i = 0; i < numStars; i++) {
                stars.push({
                    x: Math.random() * canvas.width,
                    y: Math.random() * canvas.height,
                    radius: Math.random() * 1.5 + 0.5, // 0.5 to 2
                    alpha: Math.random(), // 0 to 1
                    velocity: Math.random() * 0.2 + 0.1 // Slower, subtle movement
                });
            }
        }
        window.initStars = initStars;

        function drawStars() {
            if (!canvas || !ctx) return; // Ensure canvas and context exist
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2, false);
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.shadowColor = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.shadowBlur = star.radius * 2;
                ctx.fill();

                star.x -= star.velocity; // Move stars horizontally
                if (star.x < -star.radius) { // Reset if off screen
                    star.x = canvas.width + star.radius;
                    star.y = Math.random() * canvas.height;
                    star.alpha = Math.random();
                }

                // Twinkle effect (subtle alpha change)
                star.alpha += (Math.random() - 0.5) * 0.02; // Small random change
                if (star.alpha > 1) star.alpha = 1;
                if (star.alpha < 0) star.alpha = 0;
            }
            requestAnimationFrame(drawStars); // Use drawStars for recursive call
        }
        window.drawStars = drawStars;


        // --- Floating Bouncing Glowing Bubbles ---
        const bubbleContainer = document.getElementById('bubble-container');
        // Increased bubble sizes and adjusted number for better visibility and bounce effect
        const numBubbles = 5; // User's preferred number of bubbles
        const bubbleSizes = [70, 90, 110, 130]; // Larger bubble sizes

        function createBubble() {
            const bubble = document.createElement('div');
            bubble.classList.add('bubble');
            const size = bubbleSizes[Math.floor(Math.random() * bubbleSizes.length)];
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            const radius = size / 2; // Calculate radius of the bubble

            const animatedVideoContainer = document.getElementById('animated-video-container');
            if (!animatedVideoContainer) {
                console.error("Animated video container not found for bubble placement.");
                return;
            }

            // Get the actual dimensions of the container
            const containerWidth = animatedVideoContainer.offsetWidth;
            const containerHeight = animatedVideoContainer.offsetHeight;

            // Define min/max pixel coordinates for the bubble's CENTER
            // This ensures the bubble's edge stays within the container
            const minX = radius;
            const maxX = containerWidth - radius;
            const minY = radius;
            const maxY = containerHeight - radius;

            // Generate 4 random points for the animation path in pixels
            const generatePointInPixels = () => ({
                x: Math.random() * (maxX - minX) + minX,
                y: Math.random() * (maxY - minY) + minY,
                scale: Math.random() * 0.4 + 0.8 // Scale between 0.8 and 1.2 for smoother size changes
            });

            const pStart = generatePointInPixels();
            const p1 = generatePointInPixels();
            const p2 = generatePointInPixels();
            const p3 = generatePointInPixels();

            // Convert pixel coordinates to percentages for CSS variables
            bubble.style.setProperty('--x-start', `${(pStart.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-start', `${(pStart.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-start', pStart.scale);

            bubble.style.setProperty('--x-point1', `${(p1.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point1', `${(p1.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point1', p1.scale);

            bubble.style.setProperty('--x-point2', `${(p2.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point2', `${(p2.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point2', p2.scale);

            bubble.style.setProperty('--x-point3', `${(p3.x / containerWidth) * 100}%`);
            bubble.style.setProperty('--y-point3', `${(p3.y / containerHeight) * 100}%`);
            bubble.style.setProperty('--scale-point3', p3.scale);


            // Random animation duration and delay
            bubble.style.animationDuration = `${Math.random() * 20 + 30}s`; // User's preferred slow motion (30-50s)
            bubble.style.animationDelay = `${Math.random() * 8}s`; // 0-8 seconds delay for more desynchronization

            const randomColorIndex = Math.floor(Math.random() * 3); // For shadow consistency
            let shadowColor;
            if (randomColorIndex === 0) shadowColor = 'rgba(0, 123, 255, 0.8)';
            else if (randomColorIndex === 1) shadowColor = 'rgba(255, 215, 0, 0.8)';
            else shadowColor = 'rgba(255, 99, 71, 0.8)';
            bubble.style.setProperty('--bubble-color-shadow', shadowColor);

            if (bubbleContainer) { // Ensure container exists
                bubbleContainer.appendChild(bubble);
            }
        }
        window.createBubble = createBubble;

        // Generate bubbles
        document.addEventListener('DOMContentLoaded', () => {
            // Wait for the container to be rendered and sized before creating bubbles
            const animatedVideoContainer = document.getElementById('animated-video-container');
            if (animatedVideoContainer) {
                // Use a small timeout to ensure layout is stable
                setTimeout(() => {
                    if (bubbleContainer) {
                        for (let i = 0; i < numBubbles; i++) {
                            createBubble();
                        }
                    }
                }, 100); // Small delay
            }
        });

        // Re-generate bubbles on resize to ensure they stay within bounds
        window.addEventListener('resize', () => {
            if (bubbleContainer) {
                bubbleContainer.innerHTML = ''; // Clear existing bubbles
                for (let i = 0; i < numBubbles; i++) {
                    createBubble();
                }
            }
        });

document.addEventListener('DOMContentLoaded', () => {
    loadBlogs();
    // Start starfield animation after canvas is ready
    if (canvas) { // Check if canvas element exists before initializing
        resizeCanvas();
        drawStars(); // Call drawStars to start the animation loop
    }
});
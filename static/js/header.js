document.addEventListener('DOMContentLoaded', function () {
    const navToggle = document.getElementById('nav-toggle');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    const mobileClose = document.getElementById('mobile-close');

    function openSidebar() {
        if (mobileSidebar) {
            mobileSidebar.classList.add('active');
            mobileSidebar.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }
    }

    function closeSidebar() {
        if (mobileSidebar) {
            mobileSidebar.classList.remove('active');
            mobileSidebar.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    if (navToggle) {
        navToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            if (mobileSidebar && mobileSidebar.classList.contains('active')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (mobileClose) {
        mobileClose.addEventListener('click', function (e) {
            e.stopPropagation();
            closeSidebar();
        });
    }

    // Close when clicking outside the sidebar
    document.addEventListener('click', function (e) {
        if (!mobileSidebar) return;
        if (!mobileSidebar.classList.contains('active')) return;
        const isClickInside = mobileSidebar.contains(e.target) || (navToggle && navToggle.contains(e.target));
        if (!isClickInside) closeSidebar();
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
    });
});

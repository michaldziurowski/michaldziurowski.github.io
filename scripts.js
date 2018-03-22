function showElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.add('visible');
}

function hideElement(elementId) {
    const element = document.getElementById(elementId);
    element.classList.remove('visible');
}

function isSmall() {
    const mediumScreenWidth = 768;
    return window.innerWidth < mediumScreenWidth;
}

function applyAnimations() {
    const container = document.getElementById('img-container');
    if (isSmall()) {
        container.classList.add('animate-move');
    } else {
        container.classList.add('animate-move2');
    }
}

// Function from David Walsh: http://davidwalsh.name/css-animation-callback
function whichAnimationEvent() {
    var t,
        el = document.createElement("fakeelement");

    var transitions = {
        "animation": "animationend",
        "OAnimation": "oAnimationEnd",
        "MozAnimation": "animationend",
        "WebkitAnimation": "webkitAnimationEnd"
    }

    for (t in transitions) {
        if (el.style[t] !== undefined) {
            return transitions[t];
        }
    }
}

window.addEventListener('load', function () {
    const animationEvent = whichAnimationEvent();
    const item = document.getElementById('img-container');
    item.addEventListener(animationEvent, animationEndCallback);

    showElement('img-container');
    applyAnimations();

    function animationEndCallback(event) {
        item.removeEventListener(animationEvent, animationEndCallback);
        showElement('speech-bubble');

        setTimeout(function () {
            hideElement('speech-bubble');
            showElement('content');
            if (isSmall()) {
                hideElement('img-container');
            }
        }, 3000);
    }
});
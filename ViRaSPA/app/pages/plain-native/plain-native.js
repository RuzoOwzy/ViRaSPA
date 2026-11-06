// Plain JavaScript: no Viraspa.* calls. The framework runs this file once,
// on the first visit, and dispatches standard DOM events on the page's
// element (they bubble to document):
//   viraspa:pageCreated  the page's HTML was just created  -> set it up
//   viraspa:pageShown    the page is on screen (each visit)
//   viraspa:pageHidden   the page was left
//   viraspa:pageRemoved  the page's HTML was removed
// event.target is the page's element; event.detail.route.name its route.
(function () {
  function isThisPage(event) {
    return event.detail.route.name === "plain-native";
  }

  document.addEventListener("viraspa:pageCreated", function (event) {
    if (!isThisPage(event)) return;
    const page = event.target;
    const button = page.querySelector(".plain-native__button");
    let clicks = 0;
    button.addEventListener("click", function () {
      clicks += 1;
      button.textContent = "Clicked " + clicks + (clicks === 1 ? " time" : " times");
    });
  });

  document.addEventListener("viraspa:pageShown", function (event) {
    if (!isThisPage(event)) return;
    const log = event.target.querySelector(".plain-native__log");
    log.textContent = "Shown at " + new Date().toLocaleTimeString() + ".";
  });
})();

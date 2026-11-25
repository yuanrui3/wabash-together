import { chatGPTSignInPath } from "./chatgpt-auth";
import { CommunityBoard } from "./community-board";
import { siteProfile } from "../lib/site-profile";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#board">Skip to the board</a>
      <header className="site-header">
        <div className="shell header-inner">
          <a className="brand" href="/" aria-label={`${siteProfile.title} home`}>
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            {siteProfile.title}
          </a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#board">Find a match</a>
            <a href="#connections">Introductions</a>
            <a className="nav-post" href="#post">Post <span className="on-wide">to the board</span></a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero shell" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span aria-hidden="true" /> {siteProfile.subtitle}</p>
            <h1 id="hero-title">A ride starts with a neighbor.</h1>
            <p className="hero-intro">Find a recurring carpool, a one-time ride going your way, or a neighbor open to sharing a car.</p>
            {siteProfile.accessNote && <p className="access-note">{siteProfile.accessNote}</p>}
            <div className="hero-actions">
              <a className="button button-primary" href="#board">Browse the board</a>
              <a className="button button-quiet" href="#post">Make a post</a>
            </div>
            <a className="guide-link" href="/guide">Watch the walkthrough</a>
          </div>
          <div className="hero-visual" role="img" aria-label="John T. Myers Pedestrian Bridge over the Wabash River">
            <div className="bridge-label">John T. Myers Pedestrian Bridge</div>
          </div>
        </section>

        <div className="shell">
          <CommunityBoard
            signIn={chatGPTSignInPath("/#board")}
            postSignIn={chatGPTSignInPath("/#post")}
            connectionsSignIn={chatGPTSignInPath("/#connections")}
          />
        </div>

        <section className="shell benefits" aria-labelledby="benefits-title">
          <h2 id="benefits-title">What we gain by sharing</h2>
          <div className="benefits-copy">
            <p>A car can be essential for a shift, a grocery run, or getting children across town. Owning one means paying for insurance, maintenance, and depreciation even on days it stays parked. Reliable access to a neighbor’s spare car can help someone who lives alone get by without owning one, or help a family put off buying a second. Sharing a regular commute can make getting to work more affordable, especially for someone without a car.</p>
            <p>In 2022, U.S. household vehicles were parked for about 95% of a typical day. Sharing some of that idle capacity can avoid a car purchase and the resources needed to build it. When two people who would otherwise drive separately carpool, one fewer vehicle makes the trip and one fewer parking space is needed at the destination.</p>
            <p className="benefits-source"><a href="https://www.energy.gov/cmei/vehicles/articles/fotw-1356-august-19-2024-household-vehicles-were-parked-95-typical-day-2022">Vehicle-use estimate from the U.S. Department of Energy</a></p>
          </div>
        </section>

        <section className="how-section" aria-labelledby="how-title" id="how">
          <div className="shell how-inner">
            <h2 id="how-title">How introductions work</h2>
            <div className="how-grid">
              <div><h3>Find a neighbor</h3><p>Search by neighborhood. For carpools, look for a similar route and schedule.</p></div>
              <div><h3>Agree to connect</h3><p>Request an introduction. Contact emails are shared only after both people agree.</p></div>
              <div><h3>Take it from there</h3><p>Continue through your own private channel and work out the details together.</p></div>
            </div>
            <p className="arrangement-note">If you plan to borrow a car, confirm coverage for the actual driver and dates. An independent booking through a service like <a href="https://turo.com/us/en/car-rental/united-states/host-hub/resources/vehicle-protection" target="_blank" rel="noreferrer">Turo</a> is one option to explore.</p>
          </div>
        </section>
      </main>

      <footer className="site-footer shell">
        <div><span className="footer-brand">{siteProfile.title}</span><p>A local board for both sides of the river.</p></div>
        <div className="footer-links"><a href="#how">How it works</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/photo">Photo credit</a></div>
      </footer>
    </>
  );
}

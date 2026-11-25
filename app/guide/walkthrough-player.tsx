"use client";

import { useRef, useState } from "react";

const clips = {
  female: "/guide-media/walkthrough-female.mp4",
  male: "/guide-media/walkthrough-male.mp4",
};

type Voice = keyof typeof clips;
type PlaybackPosition = {
  time: number;
  playing: boolean;
  rate: number;
  volume: number;
  muted: boolean;
  captions?: TextTrackMode;
};

export function WalkthroughPlayer() {
  const [voice, setVoice] = useState<Voice>("female");
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const resume = useRef<PlaybackPosition | null>(null);

  function chooseVoice(next: Voice) {
    const video = player.current;
    if (!video || next === voice) return;

    // Keep the original position if the listener switches again before metadata loads.
    const saved = resume.current ?? {
      time: video.currentTime,
      playing: !video.paused && !video.ended,
      rate: video.playbackRate,
      volume: video.volume,
      muted: video.muted,
      captions: video.textTracks[0]?.mode,
    };
    resume.current = saved;
    setFailed(false);
    setVoice(next);

    // Start the new resource during the gesture so mobile browsers can resume audio.
    video.src = clips[next];
    video.load();
    if (saved.playing) void video.play().catch(() => { /* Native controls remain available. */ });
  }

  function restorePosition() {
    const video = player.current;
    const saved = resume.current;
    setFailed(false);
    if (!video || !saved || video.currentSrc !== video.src || video.readyState < 1) return;
    video.currentTime = Math.min(saved.time, video.duration);
    video.playbackRate = saved.rate;
    video.volume = saved.volume;
    video.muted = saved.muted;
    if (saved.captions && video.textTracks[0]) video.textTracks[0].mode = saved.captions;
    resume.current = null;
  }

  return (
    <>
      <video
        ref={player}
        className="guide-video"
        aria-label="How to use the community board"
        controls
        playsInline
        preload="metadata"
        poster="/guide-media/poster.jpg"
        src={clips.female}
        onLoadedMetadata={restorePosition}
        onError={() => setFailed(true)}
      >
        <track kind="captions" src="/guide-media/walkthrough.vtt" srcLang="en" label="English" default />
        <a href={clips[voice]}>Open the walkthrough video</a>
      </video>
      <fieldset className="guide-voices">
        <legend>Narration</legend>
        <label><input type="radio" name="narration" checked={voice === "female"} onChange={() => chooseVoice("female")} /> Female voice</label>
        <label><input type="radio" name="narration" checked={voice === "male"} onChange={() => chooseVoice("male")} /> Male voice</label>
      </fieldset>
      {failed && <p role="status">The video couldn’t load. <a href={clips[voice]}>Open the video directly</a>.</p>}
    </>
  );
}

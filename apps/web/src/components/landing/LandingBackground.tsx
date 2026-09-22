"use client";

export function LandingBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none">
      {/* Responsive YouTube Embed Cinematic Background */}
      <div className="absolute inset-0 w-full h-full scale-125 lg:scale-110 transform origin-center filter brightness-[0.65] contrast-125 opacity-75">
        <iframe
          className="w-full h-full object-cover pointer-events-none"
          src="https://www.youtube.com/embed/XoJ1TquP9ZU?autoplay=1&mute=1&loop=1&playlist=XoJ1TquP9ZU&start=539&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1"
          title="Quorum Cinematic Background"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          style={{
            width: "100vw",
            height: "56.25vw",
            minHeight: "100vh",
            minWidth: "177.77vh",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* Ambient Dark Gradient Overlays for high readability and luxury depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/50 to-[#030712]/75" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#030712]/95 via-[#030712]/40 to-[#030712]/80" />

      {/* Subtle Cypherpunk Radial Highlights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[250px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
    </div>
  );
}

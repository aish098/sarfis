import { motion as M, useReducedMotion } from "framer-motion";

export default function ShinyText({
  text = "Product Leader.",
  baseColor = "#64CEFB",
  shineColor = "#ffffff",
  speed = 3,
  spread = 100
}) {
  const shouldReduceMotion = useReducedMotion();

  const animation = shouldReduceMotion
    ? {}
    : {
        backgroundPosition: ["200% 0", "-200% 0"],
        transition: {
          duration: speed,
          repeat: Infinity,
          ease: "linear"
        }
      };

  return (
    <M.span
      animate={animation}
      style={{
        background: `linear-gradient(${spread}deg, ${baseColor} 30%, ${shineColor} 50%, ${baseColor} 70%)`,
        backgroundSize: "200% auto",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        textFillColor: "transparent",
        WebkitTextFillColor: "transparent",
        display: "inline-block",
        willChange: shouldReduceMotion ? "auto" : "background-position"
      }}
    >
      {text}
    </M.span>
  );
}

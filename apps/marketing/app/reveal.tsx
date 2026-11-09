"use client";

import { createElement, useEffect, useState, type ReactNode } from "react";

type Tag = "div" | "li" | "article";

export function Reveal({
  as = "div",
  className = "",
  delay = 0,
  children,
}: {
  as?: Tag;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.setAttribute("data-in", "true");
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        node.setAttribute("data-in", "true");
        observer.disconnect();
        const clearDelay = () => {
          node.style.transitionDelay = "";
          node.removeEventListener("transitionend", clearDelay);
        };
        node.addEventListener("transitionend", clearDelay);
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return createElement(
    as,
    {
      ref: setNode,
      "data-reveal": "",
      className,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}

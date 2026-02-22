"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

const tourSteps = [
  {
    target: '[data-tour="dashboard"]',
    content: "This is your dashboard overview — see revenue, transactions, and quick stats at a glance.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="payment-links"]',
    content: "Create shareable payment links for one-time or recurring payments. Add expiration dates, loyalty tokens, and receipt NFTs.",
  },
  {
    target: '[data-tour="transactions"]',
    content: "View all incoming payments with full details. Export data as CSV or JSON.",
  },
  {
    target: '[data-tour="invoices"]',
    content: "Create professional invoices with auto-calculated totals and send them to customers.",
  },
  {
    target: '[data-tour="analytics"]',
    content: "Track your business performance with detailed analytics and charts.",
  },
  {
    target: '[data-tour="settings"]',
    content: "Configure your merchant profile, webhook URLs, and notification preferences.",
  },
];

export function DashboardTour() {
  const searchParams = useSearchParams();
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (searchParams.get("tour") === "true") {
      // Delay slightly so sidebar mounts first
      const timer = setTimeout(() => setRun(true), 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!run) return null;

  return (
    <Joyride
      steps={tourSteps}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableOverlayClose
      callback={(data) => {
        if (data.status === "finished" || data.status === "skipped") {
          setRun(false);
          // Remove tour param from URL
          window.history.replaceState({}, "", "/dashboard");
        }
      }}
      styles={{
        options: {
          primaryColor: "#0AC18E",
          zIndex: 10000,
        },
      }}
    />
  );
}

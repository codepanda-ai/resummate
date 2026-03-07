"use client";

import { motion } from "framer-motion";

import { SummarizeIcon } from "./icons";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-2xl">
        <p className="flex flex-row justify-center gap-4 items-center">
          <SummarizeIcon size={32} />
        </p>
        <div className="text-foreground">
          <p>
            <b>Resummate</b> is your AI-powered interview coach that helps you ace your next interview.
          </p>
          <p className="mt-4">
            Practice realistic behavioral, situational, and technical interview questions tailored to your resume and target role.
            Get real-time feedback and a detailed performance report when you&apos;re done.
          </p>
          <p className="mt-4">
            Upload your resume and job description, then tap <b>Start interview session</b> to begin.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

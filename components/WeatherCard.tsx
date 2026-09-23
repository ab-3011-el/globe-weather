"use client";

interface WeatherCardProps {
  title: string;
  value: string | number;
}

export default function WeatherCard({
  title,
  value,
}: WeatherCardProps) {
  return (
    <div
      className="
        group
        min-w-0
        overflow-hidden
        rounded-[20px]
        border
        border-white/[0.08]
        bg-gradient-to-br
        from-slate-900/90
        to-slate-950/80
        px-5
        py-5
        shadow-[0_15px_40px_rgba(0,0,0,0.2)]
        backdrop-blur-xl
        transition
        duration-300
        hover:-translate-y-0.5
        hover:border-blue-400/20
      "
    >
      <p
        className="
          truncate
          text-[11px]
          font-bold
          uppercase
          tracking-[0.14em]
          text-slate-400
        "
      >
        {title}
      </p>

      <p
        title={String(value)}
        className="
          mt-3
          truncate
          text-[29px]
          font-extrabold
          leading-none
          tracking-[-0.035em]
          text-white
        "
      >
        {value}
      </p>
    </div>
  );
}
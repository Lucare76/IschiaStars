import Image from "next/image";

type IschiaStarsLogoProps = {
  size?: number;
  className?: string;
  light?: boolean;
};

const logoSrc = "/ischiastars-logo.png";

export function IschiaStarsLogo({ size = 72, className, light = false }: IschiaStarsLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      <Image
        alt="IschiaStars"
        className="shrink-0 object-contain drop-shadow-sm"
        height={size}
        priority
        src={logoSrc}
        width={size}
      />
      <div>
        <p className={`brand-logo text-sm font-black uppercase tracking-[0.16em] ${light ? "text-white" : "text-ischia-navy"}`}>Preventivi</p>
        <p className={`text-xs font-medium ${light ? "text-white/75" : "text-ischia-blue"}`}>Vacanze a Ischia su misura</p>
      </div>
    </div>
  );
}

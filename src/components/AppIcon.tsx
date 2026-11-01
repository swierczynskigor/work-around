import Image from "next/image";

export function AppIcon({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/icons/workaround.svg"
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      unoptimized
    />
  );
}

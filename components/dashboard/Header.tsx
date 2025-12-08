"use client";

interface HeaderProps {
  greeting?: string;
  title?: string;
}

export default function Header({
  greeting = "Hello,",
  title = "Welcome to Relay",
}: HeaderProps) {
  return (
    <header className="flex items-start justify-between px-6 pt-4 pb-3">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium">
          {greeting}
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-black">
          {title}
        </h1>
      </div>
    </header>
  );
}

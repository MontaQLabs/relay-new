import Image from "next/image";
type TabType = "joined" | "created" | "all";

export function EmptyState({ activeTab }: { activeTab: TabType }) {
  const getMessage = () => {
    switch (activeTab) {
      case "joined":
        return {
          title: "You haven't joined any community",
          description: "You can create a community or search the community ID you want to join.",
        };
      case "created":
        return {
          title: "You haven't created any community",
          description: "Create your first community and become a leader.",
        };
      case "all":
        return {
          title: "No communities yet",
          description: "Be the first to create a community!",
        };
      default:
        return {
          title: "No communities found",
          description: "Try searching or creating a new community.",
        };
    }
  };

  const { title, description } = getMessage();

  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <Image src="/empty-box.svg" alt="Empty Box Illustration" width={240} height={180} />
      <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
    </div>
  );
}

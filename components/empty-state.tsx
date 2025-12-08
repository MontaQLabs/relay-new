import Image from "next/image";
type TabType = "joined" | "created";

export function EmptyState({ activeTab }: { activeTab: TabType }) {
    return (
      <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
        <Image src="/empty-box.svg" alt="Empty Box Illustration" width={240} height={180} />
        <h3 className="text-lg font-semibold text-black mb-2">
          {activeTab === "joined"
            ? "You haven't joined any community"
            : "You haven't created any community"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {activeTab === "joined"
            ? "You can create a community or search the community ID you want to join."
            : "Create your first community and become a leader."}
        </p>
      </div>
    );
  }
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import JournalCard from "@/components/JournalCard";
import TagSelector from "@/components/TagSelector";
import { PlusIcon, BookOpenIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

export default function Journal() {
  const [showDialog, setShowDialog] = useState(false);
  const [entryText, setEntryText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const entries = useQuery(api.journal.listJournalEntries, { 
    limit: 50,
    searchTerm: searchTerm || undefined,
  });
  const addEntry = useMutation(api.journal.addJournalEntry);
  const deleteEntry = useMutation(api.journal.deleteJournalEntry);

  const handleSaveEntry = async () => {
    if (!entryText.trim()) {
      toast.error("Please write something first");
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      await addEntry({
        dateIso: today,
        text: entryText,
        tags: selectedTags,
      });
      toast.success("Entry saved!");
      setEntryText("");
      setSelectedTags([]);
      setShowDialog(false);
    } catch (error) {
      toast.error("Failed to save entry");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm("Delete this journal entry?")) return;
    
    try {
      await deleteEntry({ entryId: entryId as never });
      toast.success("Entry deleted");
    } catch (error) {
      toast.error("Failed to delete entry");
    }
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (entries === undefined) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Journal</h1>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <PlusIcon className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Textarea
                  value={entryText}
                  onChange={(e) => setEntryText(e.target.value)}
                  placeholder="What's on your mind?"
                  className="min-h-[200px] resize-none"
                />
              </div>
              
              <TagSelector
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
              />

              <div className="flex gap-2">
                <Button onClick={handleSaveEntry} className="flex-1">
                  Save Entry
                </Button>
                <Button
                  onClick={() => {
                    setShowDialog(false);
                    setEntryText("");
                    setSelectedTags([]);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search entries by text or tag..."
          className="pl-10"
        />
      </div>

      {/* Entries List */}
      {entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpenIcon />
            </EmptyMedia>
            <EmptyTitle>No journal entries yet</EmptyTitle>
            <EmptyDescription>
              Start journaling to track your thoughts and feelings
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => setShowDialog(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create First Entry
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <JournalCard
              key={entry._id}
              entry={entry}
              onDelete={() => handleDeleteEntry(entry._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X } from "lucide-react";

interface WebsiteEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  initialHtml: string;
  onSave: (customizations: WebsiteCustomizations) => void;
  isSaving: boolean;
}

export interface WebsiteCustomizations {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  businessName: string;
  headline: string;
  services: string;
  contactInfo: string;
}

export function WebsiteEditorModal({
  open,
  onOpenChange,
  leadId,
  initialHtml,
  onSave,
  isSaving,
}: WebsiteEditorModalProps) {
  const [customizations, setCustomizations] = useState<WebsiteCustomizations>({
    primaryColor: "#3b82f6", // blue-500
    secondaryColor: "#8b5cf6", // violet-500
    backgroundColor: "#ffffff",
    businessName: "",
    headline: "",
    services: "",
    contactInfo: "",
  });

  const [previewHtml, setPreviewHtml] = useState(initialHtml);

  // Update preview when customizations change
  useEffect(() => {
    if (!initialHtml) return;

    let updatedHtml = initialHtml;

    // Replace colors in CSS
    updatedHtml = updatedHtml.replace(/#3b82f6/g, customizations.primaryColor);
    updatedHtml = updatedHtml.replace(/#8b5cf6/g, customizations.secondaryColor);
    updatedHtml = updatedHtml.replace(/background-color:\s*#ffffff/g, `background-color: ${customizations.backgroundColor}`);

    // Replace content (if fields are filled)
    if (customizations.businessName) {
      updatedHtml = updatedHtml.replace(/<h1[^>]*>.*?<\/h1>/, `<h1>${customizations.businessName}</h1>`);
    }
    if (customizations.headline) {
      updatedHtml = updatedHtml.replace(/<h2[^>]*>.*?<\/h2>/, `<h2>${customizations.headline}</h2>`);
    }

    setPreviewHtml(updatedHtml);
  }, [customizations, initialHtml]);

  const handleSave = () => {
    onSave(customizations);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Website</DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-[350px_1fr] gap-4 overflow-hidden">
          {/* Left Panel: Customization Controls */}
          <div className="overflow-y-auto space-y-6 pr-4">
            {/* Colors Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Colors</h3>
              
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={customizations.primaryColor}
                    onChange={(e) => setCustomizations({ ...customizations, primaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={customizations.primaryColor}
                    onChange={(e) => setCustomizations({ ...customizations, primaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={customizations.secondaryColor}
                    onChange={(e) => setCustomizations({ ...customizations, secondaryColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={customizations.secondaryColor}
                    onChange={(e) => setCustomizations({ ...customizations, secondaryColor: e.target.value })}
                    className="flex-1"
                    placeholder="#8b5cf6"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="backgroundColor">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={customizations.backgroundColor}
                    onChange={(e) => setCustomizations({ ...customizations, backgroundColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    type="text"
                    value={customizations.backgroundColor}
                    onChange={(e) => setCustomizations({ ...customizations, backgroundColor: e.target.value })}
                    className="flex-1"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Content</h3>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={customizations.businessName}
                  onChange={(e) => setCustomizations({ ...customizations, businessName: e.target.value })}
                  placeholder="Leave empty to keep original"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={customizations.headline}
                  onChange={(e) => setCustomizations({ ...customizations, headline: e.target.value })}
                  placeholder="Leave empty to keep original"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="services">Services (comma-separated)</Label>
                <Textarea
                  id="services"
                  value={customizations.services}
                  onChange={(e) => setCustomizations({ ...customizations, services: e.target.value })}
                  placeholder="Service 1, Service 2, Service 3"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactInfo">Contact Info</Label>
                <Textarea
                  id="contactInfo"
                  value={customizations.contactInfo}
                  onChange={(e) => setCustomizations({ ...customizations, contactInfo: e.target.value })}
                  placeholder="Phone, Email, Address"
                  rows={3}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save & Regenerate
                  </>
                )}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
                disabled={isSaving}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>

          {/* Right Panel: Live Preview */}
          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
              Live Preview
            </div>
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full"
              title="Website Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import InstagramLoginButton from "@/components/InstagramLoginButton";
import InstagramPostForm from "@/components/InstagramPostForm";

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Instagram Account Manager</h1>
      <p className="mb-4">Connect your Instagram account to get started.</p>
      <InstagramLoginButton />
      {/* TODO: Add logic to list connected accounts here */}
      <InstagramPostForm />
    </div>
  );
}

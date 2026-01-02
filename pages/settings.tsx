"use client";

import { useEffect, useState, type CSSProperties } from "react";
import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import Cropper, { type Area } from "react-easy-crop";
import ProfileBackdropModal from "../components/settings/ProfileBackdropModal";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
};

type SupaUser = any;
type TabKey = "profile" | "avatar";

const checkerboardStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)," +
    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)",
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0,6px 6px",
};

const SettingsPage: NextPage = () => {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<SupaUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [pageError, setPageError] = useState<string | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formBio, setFormBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(
    null
  );

  const [saveError, setSaveError] = useState<string | null>(null);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  const [openBackdropModal, setOpenBackdropModal] = useState(false);

  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null
  );
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null);

  const [avatarRemoved, setAvatarRemoved] = useState(false);

  // ---------- AUTH CHECK ----------
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      setAuthChecking(true);
      setPageError(null);

      const res = await supabase.auth.getUser();
      if (cancelled) return;

      const { data, error } = res;

      if (error || !data.user) {
        setAuthUser(null);
        setPageError("You must be logged in to view settings.");
        setAuthChecking(false);
        setProfileLoading(false);
      } else {
        setAuthUser(data.user);
        setAuthChecking(false);
      }
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- LOAD PROFILE ----------
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      setPageError(null);

      const { data: rows, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, bio, created_at")
        .eq("id", authUser.id)
        .limit(1);

      if (cancelled) return;

      const row = rows?.[0] ?? null;

      if (error || !row) {
        setProfile(null);
        setProfileLoading(false);
        setPageError("Profile not found for this account.");
        return;
      }

      setProfile(row as Profile);
      setFormUsername(row.username ?? "");
      setFormBio(row.bio ?? "");
      setAvatarRemoved(false);
      setProfileLoading(false);
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // ---------- AVATAR PREVIEW (FILE -> OBJECT URL) ----------
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [avatarFile]);

  // ---------- CROP COMPLETE ----------
  const onCropComplete = (_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  };

  useEffect(() => {
    const generatePreview = async () => {
      if (!avatarPreviewUrl || !croppedAreaPixels) {
        setCroppedPreview(null);
        return;
      }

      try {
        const preview = await getCroppedImageDataUrl(
          avatarPreviewUrl,
          croppedAreaPixels
        );
        setCroppedPreview(preview);
      } catch {
        // ignore preview errors
      }
    };

    generatePreview();
  }, [avatarPreviewUrl, croppedAreaPixels]);

  // ---------- SAVE PROFILE (username + bio) ----------
  async function saveProfile() {
    if (!profile || !authUser) return;

    setSaveError(null);

    const trimmed = formUsername.trim();
    if (!trimmed) {
      setSaveError("Username cannot be empty.");
      setActiveTab("profile");
      return;
    }

    const newUsername = trimmed.toLowerCase();
    const newBio = formBio.trim();

    setSavingProfile(true);

    try {
      // uniqueness check if username changed
      if (newUsername !== profile.username) {
        const { count, error: uniqError } = await supabase
          .from("profiles")
          .select("id", { head: true, count: "exact" })
          .eq("username", newUsername)
          .neq("id", profile.id);

        if (uniqError) throw uniqError;

        if (typeof count === "number" && count > 0) {
          setActiveTab("profile");
          setSaveError("That username is already taken.");
          setSavingProfile(false);
          return;
        }
      }

      const updates = {
        username: newUsername,
        bio: newBio || null,
      };

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", profile.id)
        .select("id, username, avatar_url, bio, created_at")
        .single();

      if (updateError) throw updateError;

      setProfile(updated as Profile);
      setSaveError(null);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  // ---------- SAVE AVATAR ONLY ----------
  async function saveAvatar() {
    if (!profile || !authUser) return;

    setSaveError(null);
    setSavingAvatar(true);

    try {
      let avatarUrlToSave: string | null = profile.avatar_url;

      if (avatarRemoved) {
        // User explicitly removed avatar
        avatarUrlToSave = null;
      } else if (avatarFile) {
        // New avatar uploaded -> use cropped version if available
        let uploadBlob: Blob | File = avatarFile;

        if (avatarPreviewUrl && croppedAreaPixels) {
          uploadBlob = await getCroppedImageBlob(
            avatarPreviewUrl,
            croppedAreaPixels
          );
        }

        const fileExt = "png"; // save cropped avatars as PNG
        const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } =
          await supabase.storage
            .from("avatars")
            .upload(filePath, uploadBlob as Blob, {
              upsert: true,
              contentType: "image/png",
            });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from("avatars")
          .getPublicUrl(uploadData.path);

        avatarUrlToSave = publicData.publicUrl;
      } else {
        // No new file, no removal -> nothing to do
        setSavingAvatar(false);
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrlToSave })
        .eq("id", profile.id)
        .select("id, username, avatar_url, bio, created_at")
        .single();

      if (updateError) throw updateError;

      setProfile(updated as Profile);

      // reset local avatar edit state
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setCroppedAreaPixels(null);
      setCroppedPreview(null);
      setAvatarRemoved(false);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  // ---------- RENDER GUARDS ----------
  if (authChecking || (authUser && profileLoading && !profile)) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">
            {pageError || "You must be logged in to view settings."}
          </p>
          <Link
            href="/"
            className="text-xs text-blue-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white shadow-sm rounded-xl px-6 py-5 space-y-2">
          <p className="text-sm text-red-500">
            {pageError || "Could not load your profile."}
          </p>
          <Link
            href="/"
            className="text-xs text-blue-600 hover:underline"
          >
            Go back home
          </Link>
        </div>
      </main>
    );
  }

  const avatarInitial = profile.username
    ? profile.username.trim().charAt(0).toUpperCase()
    : "?";

  const baseAvatarImage = avatarRemoved
    ? null
    : avatarPreviewUrl || profile.avatar_url || null;

  const tabLiClass = (tab: TabKey) =>
    [
      "pb-1 text-xs font-semibold tracking-wide uppercase border-b-2",
      activeTab === tab
        ? "border-slate-900 text-slate-900"
        : "border-transparent text-slate-400 hover:text-slate-900",
    ].join(" ");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* HEADER */}
        <header className="mb-6 border-b border-slate-200 pb-3">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Account Settings</h1>
            <Link
              href={`/${profile.username}`}
              className="text-xs text-slate-500 hover:underline"
            >
              Back to profile
            </Link>
          </div>

          <div className="mt-4 flex items-start justify-between gap-4">
            <nav aria-label="Account settings tabs" className="flex-1">
              <ul className="flex flex-wrap gap-6">
                <li className={tabLiClass("profile")}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("profile")}
                    className="focus:outline-none"
                  >
                    Profile
                  </button>
                </li>
                <li className={tabLiClass("avatar")}>
                  <button
                    type="button"
                    onClick={() => setActiveTab("avatar")}
                    className="focus:outline-none"
                  >
                    Avatar
                  </button>
                </li>
              </ul>
            </nav>

            <section className="text-right">
              <p className="text-[11px] text-slate-500">
                Upgrade to <span className="font-semibold">Pro</span> for
                additional features
              </p>
            </section>
          </div>
        </header>

        {/* CONTENT */}
        <section className="text-sm">
          {saveError && (
            <p className="mb-3 text-sm text-red-500">{saveError}</p>
          )}

          <div className="space-y-5">
            {/* PROFILE TAB */}
            {activeTab === "profile" && (
              <div className="max-w-xl space-y-4 bg-white rounded-xl border border-slate-200 p-5">
                <div className="space-y-1">
                  <label
                    htmlFor="username"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Your handle. Will be stored in lowercase.
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="bio"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tell people a little about yourself.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setOpenBackdropModal(true)}
                    className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  >
                    Edit backdrop
                  </button>

                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={savingProfile}
                    className="inline-flex items-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                  >
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </div>
              </div>
            )}

            {/* AVATAR TAB */}
            {activeTab === "avatar" && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold">Avatar</h2>

                <div className="rounded-md overflow-hidden border border-slate-200 bg-white">
                  {baseAvatarImage ? (
                    <>
                      <div className="flex flex-col md:flex-row">
                        {/* LEFT: crop workspace */}
                        <div className="md:w-2/3 border-b md:border-b-0 md:border-r border-slate-200">
                          <div
                            className="relative w-full h-96 md:h-[28rem] overflow-hidden"
                            style={checkerboardStyle}
                          >
                            <Cropper
                              image={baseAvatarImage}
                              crop={crop}
                              zoom={zoom}
                              aspect={1}
                              showGrid={false}
                              onCropChange={setCrop}
                              onZoomChange={setZoom}
                              onCropComplete={onCropComplete}
                              cropShape="round"
                            />
                          </div>
                        </div>

                        {/* RIGHT: live preview */}
                        <div className="md:w-1/3 flex items-center justify-center px-6 py-6">
                          <div className="text-center space-y-3">
                            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden mx-auto">
                              {croppedPreview ? (
                                <img
                                  src={croppedPreview}
                                  alt="Avatar preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : baseAvatarImage ? (
                                <img
                                  src={baseAvatarImage}
                                  alt="Avatar preview"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-lg font-semibold text-slate-700">
                                  {avatarInitial}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-semibold text-slate-900">
                              {profile.username}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              This is how your avatar will appear.
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // PRE-UPLOAD STATE (unchanged)
                    <div className="border-b border-slate-200">
                      <label
                        htmlFor="avatar-upload"
                        className="relative w-full h-96 md:h-[28rem] group overflow-hidden flex items-center justify-center cursor-pointer"
                        style={checkerboardStyle}
                      >
                        {/* Base content: centered avatar circle (behind overlay) */}
                        <div className="relative flex items-center justify-center h-full z-0">
                          <div className="w-40 h-40 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                            <span className="text-lg font-semibold text-slate-700">
                              {avatarInitial}
                            </span>
                          </div>
                        </div>

                        {/* Hover overlay with text */}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition z-10">
                          <p className="text-2xl md:text-3xl font-semibold text-white opacity-0 group-hover:opacity-100 transition text-center px-4">
                            Drag and drop an image
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Toolbar bottom */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAvatarFile(file);
                        setCrop({ x: 0, y: 0 });
                        setZoom(1);
                        setCroppedAreaPixels(null);
                        setCroppedPreview(null);
                        setAvatarRemoved(false);
                      }}
                    />

                    {baseAvatarImage ? (
                      // POST-IMAGE STATE: zoom on left, buttons on right
                      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                        {/* Zoom slider (left, shorter) */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">
                            Zoom
                          </span>
                          <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={(e) =>
                              setZoom(parseFloat(e.target.value))
                            }
                            className="w-40 md:w-64"
                          />
                        </div>

                        {/* Buttons (right) */}
                        <div className="flex items-center gap-4 md:ml-auto">
                          {/* Save avatar now actually saves */}
                          <button
                            type="button"
                            onClick={saveAvatar}
                            disabled={savingAvatar}
                            className="inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
                          >
                            {savingAvatar ? "Saving…" : "Save avatar"}
                          </button>

                          <label
                            htmlFor="avatar-upload"
                            className="text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                          >
                            Change image
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setAvatarFile(null);
                              setAvatarPreviewUrl(null);
                              setCroppedAreaPixels(null);
                              setCroppedPreview(null);
                              setAvatarRemoved(true);
                            }}
                            className="text-xs text-red-500 hover:text-red-600 cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      // PRE-IMAGE STATE toolbar (unchanged)
                      <div className="grid grid-cols-3 items-center">
                        <div />
                        <label
                          htmlFor="avatar-upload"
                          className="justify-self-center inline-flex items-center justify-center px-5 py-2 text-xs font-semibold rounded-full bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                        >
                          Select new avatar
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarFile(null);
                            setAvatarPreviewUrl(null);
                            setCroppedAreaPixels(null);
                            setCroppedPreview(null);
                            setAvatarRemoved(true);
                          }}
                          className="justify-self-end text-xs text-red-500 hover:text-red-600 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-[11px] text-slate-500 text-center max-w-3xl">
                  Avatars should be JPEG or PNG. Larger images will be resized.
                  The checkerboard area shows the whole image; the circle shows
                  what will be kept as your avatar.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
      <ProfileBackdropModal
        open={openBackdropModal}
        onClose={() => setOpenBackdropModal(false)}
        userId={profile.id}
        username={profile.username}
        avatarUrl={profile.avatar_url}
      />
    </main>
  );
};

export default SettingsPage;

/** Used for live preview of the crop */
async function getCroppedImageDataUrl(
  imageSrc: string,
  crop: Area
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return canvas.toDataURL("image/png");
}

/** Used when actually saving to Supabase */
async function getCroppedImageBlob(
  imageSrc: string,
  crop: Area
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D context");

  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas is empty"));
    }, "image/png");
  });
}

function createImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.src = src;
  });
}

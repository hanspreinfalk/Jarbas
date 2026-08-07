/** Shared Clerk chrome tuned to Deploy Co / Jarbas (square, navy, cream). */
export const jarbasClerkAppearance = {
  variables: {
    colorPrimary: "#080870",
    colorText: "#0a0a0a",
    colorTextSecondary: "#5c5c66",
    colorBackground: "#ffffff",
    colorInputBackground: "#f7f5ee",
    colorInputText: "#0a0a0a",
    colorNeutral: "#0a0a0a",
    colorDanger: "#dc2626",
    colorSuccess: "#080870",
    borderRadius: "0px",
    fontFamily: "var(--font-sans)",
    fontFamilyButtons: "var(--font-sans)",
    fontSize: "0.875rem",
  },
  elements: {
    rootBox: "font-[family-name:var(--font-sans)]",
    card: "rounded-none! border! border-[#e6e4dc]! bg-white! shadow-none!",
    cardBox: "rounded-none! shadow-none!",
    scrollBox: "rounded-none!",
    modalContent: "rounded-none! shadow-none!",
    modalCloseButton:
      "rounded-none! text-[#5c5c66]! hover:bg-[#f7f5ee]! hover:text-[#0a0a0a]!",
    headerTitle:
      "font-[family-name:var(--font-display)]! text-[#0a0a0a]! tracking-tight!",
    headerSubtitle: "text-[#5c5c66]!",
    navbar: "rounded-none! border-r! border-[#e6e4dc]! bg-[#f7f5ee]!",
    navbarButton:
      "rounded-none! text-[#0a0a0a]! data-[active=true]:bg-white! data-[active=true]:shadow-none!",
    navbarButtonIcon: "text-[#080870]!",
    pageScrollBox: "bg-white!",
    profileSectionTitleText: "text-[#0a0a0a]! text-sm! font-semibold!",
    profileSectionContent: "text-sm!",
    profileSectionPrimaryButton:
      "rounded-none! border! border-[#e6e4dc]! bg-white! text-[#0a0a0a]! hover:bg-[#f7f5ee]!",
    accordionTriggerButton: "rounded-none! hover:bg-[#f7f5ee]!",
    formButtonPrimary:
      "rounded-none! bg-[#080870]! text-white! shadow-none! hover:bg-[#080870]/90!",
    formButtonReset: "rounded-none! text-[#080870]!",
    formFieldLabel:
      "text-[#5c5c66]! text-xs! font-medium! uppercase! tracking-[0.14em]!",
    formFieldInput:
      "rounded-none! border-[#e6e4dc]! bg-[#f7f5ee]! text-[#0a0a0a]! shadow-none! focus:border-[#080870]! focus:ring-[#080870]!",
    formFieldInputShowPasswordButton: "rounded-none! text-[#5c5c66]!",
    socialButtonsBlockButton:
      "rounded-none! border! border-[#e6e4dc]! bg-white! text-[#0a0a0a]! shadow-none! hover:bg-[#f7f5ee]!",
    socialButtonsBlockButtonText: "font-medium!",
    dividerLine: "bg-[#e6e4dc]!",
    dividerText: "text-[#5c5c66]!",
    // Do not hide global `footer` / `footerAction` — that also kills Checkout drawer CTAs.
    footerPages: "hidden!",
    identityPreviewEditButton: "rounded-none! text-[#080870]!",
    badge: "rounded-none! border! border-[#e6e4dc]! bg-[#f7f5ee]! text-[#5c5c66]!",
    avatarBox: "rounded-none!",
    avatarImage: "rounded-none!",
    userPreviewMainIdentifier: "text-sm! font-semibold! text-[#0a0a0a]!",
    userPreviewSecondaryIdentifier: "text-[11px]! text-[#5c5c66]!",

    // Keep billing checkout drawers above the Tauri shell chrome.
    drawerBackdrop: "z-[200]!",
    drawerRoot: "z-[210]!",
    drawerContent: "rounded-none! border! border-[#e6e4dc]! shadow-none!",
    drawerFooter: "rounded-none!",

    userButtonBox: "w-full!",
    userButtonTrigger: "w-full! rounded-none! focus:shadow-none! focus:ring-0!",
    userButtonAvatarBox: "size-7! rounded-none!",
    userButtonPopoverCard:
      "rounded-none! border! border-[#e6e4dc]! bg-white! shadow-none!",
    userButtonPopoverMain: "rounded-none!",
    userButtonPopoverActions: "rounded-none!",
    userButtonPopoverActionButton:
      "rounded-none! text-[#0a0a0a]! hover:bg-[#f7f5ee]!",
    userButtonPopoverActionButtonText: "text-sm! font-medium!",
    userButtonPopoverActionButtonIcon: "text-[#5c5c66]!",
    userButtonPopoverFooter: "hidden!",

    organizationSwitcherTrigger:
      "h-8! max-w-[14rem]! rounded-none! border! border-[#e6e4dc]! bg-white! px-2! text-xs! font-medium! text-[#0a0a0a]! shadow-none! hover:bg-[#f7f5ee]!",
    organizationSwitcherTriggerIcon: "text-[#5c5c66]!",
    organizationPreviewAvatarBox: "size-5! rounded-none!",
    organizationPreviewMainIdentifier: "truncate! text-xs! font-medium!",
    organizationSwitcherPopoverCard:
      "rounded-none! border! border-[#e6e4dc]! bg-white! shadow-none!",
    organizationSwitcherPopoverActions: "rounded-none!",
    organizationSwitcherPopoverActionButton:
      "rounded-none! text-[#0a0a0a]! hover:bg-[#f7f5ee]!",
    organizationSwitcherPopoverActionButtonText: "text-sm! font-medium!",
    organizationSwitcherPopoverActionButtonIcon: "text-[#5c5c66]!",
    organizationSwitcherPopoverFooter: "hidden!",
    organizationListPreviewButton: "rounded-none! hover:bg-[#f7f5ee]!",

    createOrganizationCard:
      "rounded-none! border! border-[#e6e4dc]! shadow-none!",
  },
};

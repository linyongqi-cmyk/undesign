export type Template = 'splitDetail' | 'articleReading' | 'photographyGallery' | 'photographyGallery2';

export type MobileLayoutMode = 'stack' | 'keep' | 'columns2' | 'scroll';
export type MobileAlign = 'left' | 'center' | 'right';
export type MobileOverride = {
  hidden?: boolean;
  displayWidth?: number;
  align?: MobileAlign;
  layout?: MobileLayoutMode;
};

export type MediaCaptionSettings = { position: 'top' | 'bottom'; gap: number };
export type ImageLinkLabel = { text: string; href: string; newTab: boolean };

export type ContentImage = {
  src: string;
  alt?: string;
  photographyDescription?: string;
  caption?: string;
  captionSettings?: MediaCaptionSettings;
  linkLabel?: ImageLinkLabel;
  cropAspect?: number;
  cropScale?: number;
  cropPosition?: string;
  mobileCropAspect?: number;
  mobileCropScale?: number;
  mobileCropPosition?: string;
  hoverZoom?: { enabled: boolean; scale: number; origin: 'left' | 'center' | 'right' };
};

export type SourceCard = { kind: 'sourceCard'; text: string; linkText?: string; href?: string; caption?: string; captionSettings?: MediaCaptionSettings };
export type FreeSizeItem =
  | { id: string; kind: 'image'; image: ContentImage; mobile?: MobileOverride }
  | { id: string; kind: 'imageCarousel'; images: ContentImage[]; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride }
  | { id: string; kind: 'localVideo'; src: string; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride }
  | { id: string; kind: 'videoEmbed'; url: string; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride }
  | { id: string; kind: 'sourceCard'; text: string; linkText?: string; href?: string; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride }
  | { id: string; kind: 'component'; block: ContentBlock; mobile?: MobileOverride };
export type FreeSizeGroup = { kind: 'freeSizeGroup'; mode: 'work' | 'research'; anchorItemId?: string; height?: number; overflowRight?: boolean; items: FreeSizeItem[] };

export type ContentBlock = { blockIndent?: number; blockIndentSize?: number; displayWidth?: number; displayHeight?: number; mobile?: MobileOverride } & (
  | { kind: 'richText'; text: string[] }
  | { kind: 'paragraph'; text: string[] }
  | { kind: 'subheading'; text: string }
  | { kind: 'note'; text: string[] }
  | { kind: 'internalLink'; text: string; category: string; workSlug?: string }
  | { kind: 'externalLink'; text: string; href: string; newTab?: boolean }
  | { kind: 'imageWithCaption'; image: ContentImage }
  | { kind: 'imagePair'; images: ContentImage[] }
  | { kind: 'mediaComposition'; overflowRight?: boolean; overflowSettings?: { align?: 'top' | 'bottom' | 'stretch'; gap?: 'default' | 'media' | number; textWidth?: 'auto' | number }; columns?: Array<{ items: Array<{ kind: 'image'; image: ContentImage; mobile?: MobileOverride } | { kind: 'imageCarousel'; images: ContentImage[]; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride } | { kind: 'content'; block: ContentBlock; mobile?: MobileOverride }> }>; items?: Array<{ kind: 'image'; image: ContentImage; mobile?: MobileOverride } | { kind: 'imageCarousel'; images: ContentImage[]; caption?: string; captionSettings?: MediaCaptionSettings; mobile?: MobileOverride } | { kind: 'content'; block: ContentBlock; mobile?: MobileOverride }> }
  | { kind: 'imageCarousel'; images: ContentImage[]; caption?: string; captionSettings?: MediaCaptionSettings }
  | { kind: 'localVideo'; src: string; caption?: string; captionSettings?: MediaCaptionSettings }
  | { kind: 'videoEmbed'; url: string; caption?: string; captionSettings?: MediaCaptionSettings }
  | { kind: 'wideMedia'; items: Array<ContentImage>; caption?: string }
  | { kind: 'quote'; quote: string }
  | { kind: 'specifications'; items?: Array<{ label: string; value: string }>; dimensions?: string; material?: string; date?: string }
  | { kind: 'link'; linkLabel: string; linkHref: string }
  | { kind: 'componentGroup'; items: ContentBlock[] }
  | { kind: 'layoutGroup'; layout: 'column' | 'row' | 'overflow'; items: ContentBlock[]; rowMode?: 'fixedHeight' | 'fixedWidth'; rowHeight?: number }
  | { kind: 'layoutGroup'; layout: 'side'; items: ContentBlock[]; sideItems: ContentBlock[]; sideGap?: number; sideMatchHeight?: boolean; sideAlign?: 'top' | 'bottom' }
  | SourceCard
  | FreeSizeGroup);

export type Work = {
  slug: string;
  category: string;
  title: string;
  type: string;
  order: number;
  image?: string;
  imageScale?: number;
  imagePosition?: string;
  masonryThumbnail?: { aspect?: number; scale?: number; position?: string; centerX?: number; centerY?: number };
  date?: string;
  dimensions?: string;
  material?: string;
  description?: string;
  gallery?: Array<string | ContentImage>;
  photographyLightboxEnabled?: boolean;
  photographyIntroWidth?: number;
  template?: Template;
  sections: ContentBlock[];
  leftSections?: ContentBlock[];
  photographyGallery2Sections?: ContentBlock[];
  articleLanguage?: 'ja' | 'zh';
  seoTitle?: string;
  seoDescription?: string;
};

export type Category = {
  slug: string;
  title: string;
  kind: 'grid' | 'masonry' | 'research';
  order: number;
  works: Work[];
};

export type HomeCover = {
  src: string;
  alt: string;
  scale: number;
  position: string;
  mobileScale?: number;
  mobilePosition?: string;
};

export type SiteSettings = {
  homeCovers: HomeCover[];
  rotationSeconds: number;
  imageCarouselSeconds?: number;
  randomHomeCover?: boolean;
  typography?: Partial<Record<'paragraph' | 'subheading' | 'note' | 'specifications' | 'internalLink' | 'externalLink', TextStylePreset>>;
  siteTitle: string;
  favicon?: string;
  adaptiveFavicon?: boolean;
  description: string;
};

export type TextStylePreset = {
  name?: string;
  fontFamily: string;
  fontSize: number | string;
  mobileFontSize?: number | string;
  fontWeight: number | string;
  color: string;
  lineHeight: number | string;
  letterSpacing: number | string;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textDecoration: 'none' | 'underline' | 'line-through';
  fontStyle: 'normal' | 'italic';
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  writingMode?: 'horizontal-tb' | 'vertical-rl';
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paragraphSpacing: number | string;
  textIndent: number | string;
};

export type AboutProfile = {
  name: string;
  romanizedName: string;
  portrait: string;
  facts: Array<{ period: string; text: string }>;
  biographyJa: string[];
  biographyFontJa?: string;
  biographyFontZh?: string;
  biographyStyleJa?: BiographyTextStyle;
  biographyStyleZh?: BiographyTextStyle;
  biographyZh: string[];
};

export type ContactSettings = {
  instagram: string;
  email: string;
  wechat: string;
};

type BiographyTextStyle = {
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  lineHeight?: number;
  letterSpacing?: number;
  paragraphSpacing?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  textDecoration?: 'none' | 'underline' | 'line-through';
  fontStyle?: 'normal' | 'italic';
};

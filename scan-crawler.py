import requests
import os
from bs4 import BeautifulSoup
import lxml.html
from lxml.cssselect import CSSSelector
import sys, getopt
import logging
import gzip
from PIL import Image
import glob
from zipfile import ZipFile
import urllib
import re
import time

# logger = logging.getLogger(__name__)
# logger.setLevel(logging.DEBUG)
logging.basicConfig( level=logging.INFO)

def build_archive_name(num):
    if(num>999):
        return str(num)
    elif(num>99):
        return "0"+str(num)
    elif(num>9):
        return "00"+str(num)
    else:
        return "000"+str(num)

def ensure_dir(f):
    if not os.path.exists(f):
        os.makedirs(f)

def build_page(num):
    if(num<10):
        return "0"+str(num)
        return str(num)
    else:
        return str(num)

def build_chapitre(num):
    if(num>99):
        return "c"+str(num)
    elif(num>9):
        return "c0"+str(num)
    else:
        return "c00"+str(num)

def build_volume(num):
    # if(num>9):
    #     return "v"+str(num)
    # else:
    #     return "v0"+str(num)
    return 'vTBD'

# The volume list will be in form [volume, [first chap., last chap.]]
def build_volume_list(file):
    tmp = open(file)
    vol_list = []
    for l in tmp.readlines():
        if(len(l)>3):
            vol_list.append([int(l.split(":")[0]), [int(i) for i in l.split(":")[1:]]])
    return vol_list

def chapter_to_volume(chap_num, volume_list):
    for i in volume_list:
        if chap_num >= i[1][0] and chap_num <= i[1][1]:
            return i[0]
    return -1

def build_url(base, volNum, chapNum, pageNum):
    return base+"/"+build_volume(volNum)+"/"+build_chapitre(chapNum)+"/"+str(pageNum)+".html"

# def find_image_link(path):
#     try:
#         fichier = open(path, "r")
#         html_str = ""
#         with open(path, "r") as fichier:
#             html_str = fichier.read()
#             #logging.debug(str(type(html_str)))
#             #logging.debug(html_str)
#             if html_str.startswith("b"):
#                 print("compatible")
#         logging.debug(html_str)
#         tree = lxml.html.fromstring(html_str)
#         img = tree.cssselect("#image")
#         return img[0].get("src")
#     except IOError:
#         return None

def find_image_link(html_str):
    tree = lxml.html.fromstring(html_str)
    img = tree.cssselect("img.lazyload")
    # print(img)
    if len(img)>0:
        return img[0].get("src")
    else:
        return -1

def find_title(html_str):
    tree = lxml.html.fromstring(html_str)
    title = tree.cssselect("h1")[0].text_content()
    if(":" in title):
        return title.split(":")[1].replace(" ", "_").lower()
    else:
        return ""

def get_page(base, volNum, chapNum, pageNum):
    url = build_url(base, volNum, chapNum, pageNum)
    logging.debug("Built URL: "+url)
    fichier = None
    reussi = False
    while not reussi:
        try :
            fichier = requests.get(url)
            if (fichier.status_code != 200):
                logging.debug("La page "+str(pageNum)+" du chapitre "+ str(chapNum)
                    +" n'existe pas, ou une redirection a eu lieu : "+url
                    +" demandée, code d'erreur "+str(fichier.status_code))
                return False
            else:
                reussi = True
        except requests.exceptions.RequestException:
            print("Une erreur a eu lieu")
    sortie = open(str(chapNum)+build_page(pageNum),'w')
    file_content = None
    # if('content-encoding' in fichier.headers):
    #     # logging.debug("Encoding: "+fichier.headers['content-encoding'])
    #     logging.debug("Le fichier est zippé")
    #     file_content = gzip.decompress(fichier.content).decode("utf-8")
    # else:
    #     file_content = fichier.content.decode("utf-8")
    sortie.write(fichier.content.decode("utf-8"))
    sortie.close()
    return True

def create_tome_archive(chapters_list, series_name, tome_number):
    with ZipFile(series_name+"_"+str(tome_number)+'.cbz', 'w') as myzip:
        for tome_index in range(len(chapters_list)):
            if chapters_list[tome_index][0] == tome_number:
                for chap_num in range(chapters_list[tome_index][1][0], chapters_list[tome_index][1][1]+1):
                    for img in glob.glob(str(chap_num)+"*.jpg"):
                        myzip.write(img)
                        os.remove(img)

def chapter_exists(url, title, chapter):
    return requests.get(url+title+"/chapter-"+str(chapter)+".html").status_code != 404

##################################### MAIN ####################################

url_base="https://365manga.net/"
titre_manga = "hunter-x-hunter"
chapNum = 289
pageNum=1
pageAbs=1
current_volume = -1
dest = None
vol_list = {}
fini = False
try:
    opts, args = getopt.getopt(sys.argv[1:],'hb:c:d:l:t:')
except getopt.GetoptError:
    print('scan-crawler.py -b <base url> -c <chapitre> -d <répertoire> -l <fichier de découpage des chapitres> -t <titre du manga>')
    sys.exit(2)

for opt, arg in opts:
    if opt == '-h':
        print('aspirateur_scan.py -b <base url> -c <chapitre> -d <répertoire> -l <fichier de découpage des chapitres> -t <titre du manga>')
        sys.exit()
    elif opt == "-b":
        url_base = arg
    elif opt == "-c":
        chapNum = int(arg)
    elif opt == "-d":
        dest = arg
    elif opt == "-l":
        vol_list = build_volume_list(arg)
        chapNum = vol_list[0][1][0]
        current_volume = vol_list[0][0]#chapter_to_volume(chapNum, vol_list)
    elif opt == "-t":
        titre_manga = arg

if dest == None:
    dest = titre_manga

os.chdir(dest)
url_base = url_base+titre_manga
previous_volume = current_volume
while(chapter_exists(url_base, titre_manga, chapNum)):
    while current_volume == previous_volume:
        logging.info("Downloading chapter : "+str(chapNum)+", volume "+str(current_volume))
        url_chapter = url_base+"/chapter-"+str(chapNum)+".html"
        logging.debug("Chapter url: "+url_chapter)
        title = find_title(requests.get(url_chapter).content)
        logging.debug("Chapter title: "+title)
        url_template = "https://s8.mkklcdnv8.com/mangakakalot/r1/read_hunter_x_hunter_manga_online_free2/chapter_{0}{1}/{2}.jpg"
        chapter_over = False
        while(not chapter_over):
            response = requests.get(url_template.format(str(chapNum), title, str(pageNum)))
            if response.status_code == 404:
                chapter_over = True
                pageNum = 1
                chapNum += 1
                current_volume = chapter_to_volume(chapNum, vol_list)
            else:
                with open(str(chapNum)+build_page(pageNum)+".jpg", "wb") as img:
                    img.write(response.content)
                # im = Image.open(response.content)
                # im.save(str(chapNum)+build_page(pageNum)+".jpg")
                pageNum += 1
    logging.info("Volume "+str(previous_volume)+" complete, archiving.")
    create_tome_archive(vol_list, titre_manga, previous_volume)
    previous_volume = chapter_to_volume(chapNum, vol_list)


# while(chapter_to_volume(chapNum, vol_list) > 0):
#     if chapter_to_volume(chapNum, vol_list) != current_volume:
#         # Un volume a été complété et peut être archivé
#         logging.info("Volume "+str(current_volume)+" complete, archiving.")
#         create_tome_archive(vol_list, titre_manga, current_volume)
#         current_volume = chapter_to_volume(chapNum, vol_list)
#     # get_page retourne faux si une redirection a lieu, ce qui indique la
#     # fin d'un chapitre
#     while(get_page(url_base, chapter_to_volume(chapNum, vol_list), chapNum, pageNum)):
#         logging.debug("Downloading page "+str(pageNum)+" of chapter "+str(chapNum))
#         url_image = find_image_link(str(chapNum)+build_page(pageNum))
#         logging.debug("image URL: "+url_image)
#         img_jpg = requests.get(url_image).content
#         logging.debug(img_jpg.info())
#         im = Image.open(img_jpg)
#         # left, up, right, down
#         xsize, ysize = im.size
#         box = (0, 0, xsize, 1125)
#         im = im.crop(box)
#         im.save(str(chapNum)+build_page(pageNum)+".jpg")
#         os.remove(str(chapNum)+build_page(pageNum))
#         pageNum += 1
#     pageNum = 1
#     chapNum += 1
    # logging.info("Downloading chapter "+str(chapNum))

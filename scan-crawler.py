import urllib
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

logger = logging.getLogger()
logger.setLevel(logging.INFO)

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
    if(num>9):
        return "v"+str(num)
    else:
        return "v0"+str(num)

def build_volume_list(file):
    tmp = open(file)
    vol_list = {}
    for l in tmp.readlines():
        if(len(l)>3):
            vol_list[int(l.split(":")[0])]=([int(l.split(":")[1]), int(l.split(":")[2])])
    return vol_list

def chapter_to_volume(chap_num, volume_list):
    for i in volume_list.keys():
        if chap_num >= volume_list[i][0] and chap_num <= volume_list[i][1]:
            return i
    return -1

def build_url(base, volNum, chapNum, pageNum):
    return base+"/"+build_volume(volNum)+"/"+build_chapitre(chapNum)+"/"+str(pageNum)+".html"

def find_image_link(path):
    try:
        fichier = open(path, "r")
        html_str = ""
        with open(path, "r") as fichier:
            html_str = fichier.read()
            #logging.debug(str(type(html_str))) 
            #logging.debug(html_str)
            if html_str.startswith("b"):
                print("compatible")
        tree = lxml.html.fromstring(html_str)
        img = tree.cssselect("#image")
        return img[0].get("src")
    except IOError:
        return None

def get_page(base, volNum, chapNum, pageNum):
    url = build_url(base, volNum, chapNum, pageNum)
    logging.debug("Built URL: "+url)
    fichier = None
    reussi = False
    while not reussi:
        try :
            fichier = urllib.request.urlopen(url)
            if (fichier.geturl() != url):
                logging.debug("La page "+str(pageNum)+" du chapitre "+ str(chapNum)
                    +" n'existe pas, ou une redirection a eu lieu : "+url
                    +" demandée, "+fichier.geturl()+" obtenu")
                return False
            else:
                reussi = True
        except urllib.error.HTTPError:
            print("Une erreur a eu lieu")
    sortie = open(str(chapNum)+build_page(pageNum),'w')
    file_content = None
    if("Content-Encoding" in fichier.info()):
        logging.debug("Le fichier est zippé")
        with gzip.open(fichier, 'r') as myzip:
            file_content = myzip.read().decode("utf-8")
    else:
        file_content = fichier.read().decode("utf-8")
    sortie.write(file_content)
    sortie.close()
    return True

def create_tome_archive(chapters_list, series_name, tome_number):
    with ZipFile(series_name+"_"+str(tome_number)+'.cbz', 'w') as myzip:
        for chap_num in range(chapters_list[tome_number][0], chapters_list[tome_number][1]+1):
            for img in glob.glob(str(chap_num)+"*.jpg"):
                myzip.write(img)
                os.remove(img)

##################################### MAIN ####################################

url_base="http://mangafox.me/manga/"
titre_manga = "one_piece"
chapNum = 1
pageNum=1
pageAbs=1
dest = None
vol_list = {}
fini = False
try:
    opts, args = getopt.getopt(sys.argv[1:],'hb:c:d:l:t:')
except getopt.GetoptError:
    print('aspirateur_scan.py -b <base url> -c <chapitre> -d <répertoire> -l <fichier de découpage des chapitres> -t <titre du manga>')
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
    elif opt == "-t":
        titre_manga = arg

if dest == None:
    dest = titre_manga

os.chdir(dest)
url_base = url_base+titre_manga
current_volume = chapter_to_volume(chapNum, vol_list)
logging.info("Starting at chapter : "+str(chapNum)+", volume "+str(current_volume))
while(chapter_to_volume(chapNum, vol_list) > 0):
    if chapter_to_volume(chapNum, vol_list) != current_volume:
        # Un volume a été complété et peut être archivé
        logging.info("Volume "+str(current_volume)+" complete, archiving.")
        create_tome_archive(vol_list, titre_manga, current_volume)
        current_volume = chapter_to_volume(chapNum, vol_list)
    # get_page retourne faux si une redirection a lieu, ce qui indique la 
    # fin d'un chapitre
    while(get_page(url_base, chapter_to_volume(chapNum, vol_list), chapNum, pageNum)):
        logging.debug("Downloading page "+str(pageNum)+" of chapter "+str(chapNum))
        url_image = find_image_link(str(chapNum)+build_page(pageNum))
        logging.debug("image URL: "+url_image)
        img_jpg = urllib.request.urlopen(url_image)
        logging.debug(img_jpg.info())
        im = Image.open(img_jpg)
        # left, up, right, down
        xsize, ysize = im.size
        box = (0, 0, xsize, 1125)
        im = im.crop(box)
        im.save(str(chapNum)+build_page(pageNum)+".jpg")
        os.remove(str(chapNum)+build_page(pageNum))
        pageNum += 1
    pageNum = 1
    chapNum += 1
    logging.info("Downloading chapter "+str(chapNum))

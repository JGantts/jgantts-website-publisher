#!/bin/bash
echo "Setting up jgantts-website-publisher for CentOS 7"
useradd jgantts-website-publisher
curl –sL https://rpm.nodesource.com/setup_16.x | bash -
yum -y install git
yum -y install nodejs
cd /root
git clone https://github.com/JGantts/jgantts-website-publisher.git
cd jgantts-website-publisher
npm install
mkdir /home/jgantts-website-publisher/working/install
cd /home/jgantts-website-publisher/working/install && npm install jgantts.com
echo "cd /root/jgantts-website-publisher/ && npm start" >> /etc/rc.d/rc.local
chmod +x /etc/rc.d/rc.local
systemctl enable rc-local
echo "done"
echo "Next steps for admin to perform:"
echo -e "\t- ADD SSL Certs to /keys/jgantts.com/"
echo -e "\t- ADD config file to /root/jgantts-website-publisher/"
echo -e "\t- Reboot"
